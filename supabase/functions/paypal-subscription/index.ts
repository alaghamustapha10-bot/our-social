import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type JsonObject = Record<string, unknown>;

class HttpError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function json(data: JsonObject, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new HttpError(`Server configuration missing: ${name}`, 500);
  return value;
}

function paypalBase() {
  const value = Deno.env.get("PAYPAL_API_BASE") || "https://api-m.paypal.com";
  if (!/^https:\/\/api-m\.(paypal\.com|sandbox\.paypal\.com)$/.test(value)) {
    throw new HttpError("Invalid PayPal API base URL", 500);
  }
  return value;
}

async function getPayPalAccessToken(): Promise<string> {
  const clientId = requiredEnv("PAYPAL_CLIENT_ID");
  const clientSecret = requiredEnv("PAYPAL_CLIENT_SECRET");
  const credentials = btoa(`${clientId}:${clientSecret}`);

  const response = await fetch(`${paypalBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    console.error("PayPal OAuth failed", response.status, data);
    throw new HttpError("Could not authenticate with PayPal", 502);
  }
  return data.access_token as string;
}

async function paypalRequest(
  token: string,
  path: string,
  method = "GET",
  body?: JsonObject,
  requestId?: string,
): Promise<JsonObject> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (requestId) headers["PayPal-Request-Id"] = requestId;

  const response = await fetch(`${paypalBase()}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("PayPal API request failed", response.status, data);
    const message =
      typeof data.message === "string" ? data.message : "PayPal request failed";
    throw new HttpError(message, response.status >= 500 ? 502 : 400);
  }
  return data as JsonObject;
}

function normalizeStatus(value: unknown): string {
  const status = String(value || "").toUpperCase();
  if (status === "ACTIVE") return "active";
  if (status === "CANCELLED") return "cancelled";
  if (status === "SUSPENDED") return "suspended";
  if (status === "EXPIRED") return "expired";
  if (status === "APPROVED" || status === "APPROVAL_PENDING") return "pending";
  return "pending";
}

function billingTime(data: JsonObject): string | null {
  const billingInfo = data.billing_info as JsonObject | undefined;
  const value = billingInfo?.next_billing_time;
  return typeof value === "string" ? value : null;
}

function subscriptionRow(
  userId: string,
  data: JsonObject,
  statusOverride?: string,
): JsonObject {
  return {
    user_id: userId,
    provider: "paypal",
    paypal_subscription_id: String(data.id || ""),
    paypal_plan_id: String(data.plan_id || ""),
    status: statusOverride || normalizeStatus(data.status),
    next_billing_time: billingTime(data),
    updated_at: new Date().toISOString(),
  };
}

async function saveSubscription(
  admin: ReturnType<typeof createClient>,
  row: JsonObject,
) {
  const subscriptionId = String(row.paypal_subscription_id || "");
  if (!subscriptionId) throw new HttpError("PayPal subscription ID is missing", 502);

  const { data: existing, error: readError } = await admin
    .from("lolz_subscriptions")
    .select("user_id")
    .eq("paypal_subscription_id", subscriptionId)
    .maybeSingle();

  if (readError) throw new HttpError("Could not read subscription record", 500);

  if (existing) {
    if (existing.user_id !== row.user_id) {
      throw new HttpError("Subscription ownership mismatch", 403);
    }
    const { error } = await admin
      .from("lolz_subscriptions")
      .update(row)
      .eq("paypal_subscription_id", subscriptionId)
      .eq("user_id", String(row.user_id));
    if (error) throw new HttpError("Could not update subscription record", 500);
  } else {
    const { error } = await admin.from("lolz_subscriptions").insert(row);
    if (error) throw new HttpError("Could not save subscription record", 500);
  }
}

async function authenticateUser(
  request: Request,
  admin: ReturnType<typeof createClient>,
) {
  const authorization = request.headers.get("Authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) throw new HttpError("Authentication required", 401);

  const { data, error } = await admin.auth.getUser(match[1]);
  if (error || !data.user) throw new HttpError("Invalid or expired session", 401);
  return data.user;
}

async function verifyPayPalWebhook(
  request: Request,
  event: JsonObject,
  token: string,
): Promise<boolean> {
  const webhookId = requiredEnv("PAYPAL_WEBHOOK_ID");
  const headers = {
    auth_algo: request.headers.get("paypal-auth-algo"),
    cert_url: request.headers.get("paypal-cert-url"),
    transmission_id: request.headers.get("paypal-transmission-id"),
    transmission_sig: request.headers.get("paypal-transmission-sig"),
    transmission_time: request.headers.get("paypal-transmission-time"),
  };

  if (Object.values(headers).some((value) => !value)) return false;

  const result = await paypalRequest(
    token,
    "/v1/notifications/verify-webhook-signature",
    "POST",
    {
      ...headers,
      webhook_id: webhookId,
      webhook_event: event,
    },
  );

  return result.verification_status === "SUCCESS";
}

async function handleWebhook(
  request: Request,
  admin: ReturnType<typeof createClient>,
  rawBody: string,
) {
  let event: JsonObject;
  try {
    event = JSON.parse(rawBody) as JsonObject;
  } catch {
    throw new HttpError("Invalid webhook JSON", 400);
  }

  const token = await getPayPalAccessToken();
  const valid = await verifyPayPalWebhook(request, event, token);
  if (!valid) throw new HttpError("Invalid PayPal webhook signature", 401);

  const eventType = String(event.event_type || "");
  const resource = (event.resource || {}) as JsonObject;
  const subscriptionId = String(
    resource.id || resource.billing_agreement_id || "",
  );

  const statusByEvent: Record<string, string> = {
    "BILLING.SUBSCRIPTION.ACTIVATED": "active",
    "BILLING.SUBSCRIPTION.CANCELLED": "cancelled",
    "BILLING.SUBSCRIPTION.SUSPENDED": "suspended",
    "BILLING.SUBSCRIPTION.EXPIRED": "expired",
    "BILLING.SUBSCRIPTION.PAYMENT.FAILED": "past_due",
  };

  if (!subscriptionId || !statusByEvent[eventType]) {
    return json({ received: true, ignored: true });
  }

  const { data: existing, error } = await admin
    .from("lolz_subscriptions")
    .select("user_id, next_billing_time")
    .eq("paypal_subscription_id", subscriptionId)
    .maybeSingle();

  if (error) throw new HttpError("Could not find subscription record", 500);

  const customUserId = typeof resource.custom_id === "string"
    ? resource.custom_id
    : null;
  const userId = existing?.user_id || customUserId;

  // Unknown events must never create a subscription for a user selected by a
  // client. Only a signature-verified PayPal event can reach this point.
  if (!userId) return json({ received: true, ignored: true });

  const row = subscriptionRow(
    userId,
    resource,
    statusByEvent[eventType],
  );

  if (!row.next_billing_time && existing?.next_billing_time) {
    row.next_billing_time = existing.next_billing_time;
  }

  await saveSubscription(admin, row);
  return json({ received: true });
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = requiredEnv("SUPABASE_URL");
    const serviceRoleKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
      requiredEnv("SERVICE_ROLE_KEY");

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const rawBody = await request.text();

    // PayPal webhooks have their own signed headers, not a Supabase user JWT.
    if (request.headers.has("paypal-transmission-id")) {
      return await handleWebhook(request, admin, rawBody);
    }

    const user = await authenticateUser(request, admin);

    let body: JsonObject;
    try {
      body = JSON.parse(rawBody || "{}") as JsonObject;
    } catch {
      throw new HttpError("Invalid request JSON", 400);
    }

    const action = String(body.action || "create");
    const token = await getPayPalAccessToken();

    if (action === "create") {
      const active = await admin
        .from("lolz_subscriptions")
        .select("paypal_subscription_id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (active.error) throw new HttpError("Could not check current subscription", 500);
      if (active.data) {
        throw new HttpError("Your LOLZ Premium subscription is already active", 409);
      }

      const planId = requiredEnv("PAYPAL_PLAN_ID");
      const appBaseUrl = (
        Deno.env.get("APP_BASE_URL") || "https://our-social-public.vercel.app"
      ).replace(/\/$/, "");

      const created = await paypalRequest(
        token,
        "/v1/billing/subscriptions",
        "POST",
        {
          plan_id: planId,
          custom_id: user.id,
          application_context: {
            brand_name: "LOLZ",
            user_action: "SUBSCRIBE_NOW",
            shipping_preference: "NO_SHIPPING",
            return_url: `${appBaseUrl}/?paypal=return`,
            cancel_url: `${appBaseUrl}/?paypal=cancel`,
          },
        },
        crypto.randomUUID(),
      );

      const row = subscriptionRow(user.id, created, "pending");
      await saveSubscription(admin, row);

      const links = Array.isArray(created.links) ? created.links : [];
      const approval = links.find((link: JsonObject) =>
        link.rel === "approve" || link.rel === "payer-action"
      ) as JsonObject | undefined;

      if (typeof approval?.href !== "string") {
        throw new HttpError("PayPal did not return an approval link", 502);
      }

      return json({
        approval_url: approval.href,
        subscription_id: created.id,
      });
    }

    if (action === "sync") {
      const subscriptionId = String(body.subscription_id || "");
      if (!subscriptionId) throw new HttpError("Subscription ID is required", 400);

      const data = await paypalRequest(
        token,
        `/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`,
      );

      const { data: existing, error } = await admin
        .from("lolz_subscriptions")
        .select("user_id")
        .eq("paypal_subscription_id", subscriptionId)
        .maybeSingle();

      if (error) throw new HttpError("Could not verify subscription owner", 500);
      if (String(data.custom_id || "") !== user.id && existing?.user_id !== user.id) {
        throw new HttpError("This subscription does not belong to your account", 403);
      }

      await saveSubscription(admin, subscriptionRow(user.id, data));
      return json({
        status: normalizeStatus(data.status),
        next_billing_time: billingTime(data),
      });
    }

    if (action === "cancel") {
      const subscriptionId = String(body.subscription_id || "");
      if (!subscriptionId) throw new HttpError("Subscription ID is required", 400);

      const { data: existing, error } = await admin
        .from("lolz_subscriptions")
        .select("user_id, next_billing_time")
        .eq("paypal_subscription_id", subscriptionId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw new HttpError("Could not verify subscription owner", 500);
      if (!existing) throw new HttpError("Subscription not found", 404);

      const details = await paypalRequest(
        token,
        `/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`,
      );

      await paypalRequest(
        token,
        `/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`,
        "POST",
        { reason: "Cancelled by LOLZ Premium subscriber" },
        crypto.randomUUID(),
      );

      const preservedNextBilling =
        billingTime(details) || existing.next_billing_time || null;

      const { error: updateError } = await admin
        .from("lolz_subscriptions")
        .update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
          next_billing_time: preservedNextBilling,
          updated_at: new Date().toISOString(),
        })
        .eq("paypal_subscription_id", subscriptionId)
        .eq("user_id", user.id);

      if (updateError) throw new HttpError("PayPal cancelled, but local status could not be updated", 500);

      return json({ status: "cancelled", next_billing_time: preservedNextBilling });
    }

    throw new HttpError("Unsupported action", 400);
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    if (!(error instanceof HttpError)) {
      console.error("PayPal subscription function failed", error);
    }
    return json({
      error: error instanceof Error ? error.message : "Unexpected server error",
    }, status);
  }
});
