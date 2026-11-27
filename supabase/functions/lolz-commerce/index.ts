import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

function paypalBase(): string {
  const value = Deno.env.get("PAYPAL_API_BASE") || "https://api-m.paypal.com";
  if (!/^https:\/\/api-m\.(paypal\.com|sandbox\.paypal\.com)$/.test(value)) {
    throw new HttpError("Invalid PayPal API base URL", 500);
  }
  return value;
}

async function getPayPalAccessToken(): Promise<string> {
  const credentials = btoa(
    `${requiredEnv("PAYPAL_CLIENT_ID")}:${requiredEnv("PAYPAL_CLIENT_SECRET")}`,
  );
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
    console.error("PayPal authentication failed", response.status);
    throw new HttpError("Could not authenticate with PayPal", 502);
  }
  return String(data.access_token);
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
    console.error("PayPal request failed", response.status, data.name || data.error);
    const message = typeof data.message === "string"
      ? data.message
      : "PayPal request failed";
    throw new HttpError(message, response.status >= 500 ? 502 : 400);
  }
  return data as JsonObject;
}

async function authenticateUser(request: Request, admin: ReturnType<typeof createClient>) {
  const authorization = request.headers.get("Authorization") || "";
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw new HttpError("Authentication required", 401);
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new HttpError("Invalid or expired session", 401);
  return data.user;
}

function eur(cents: number): string {
  return (cents / 100).toFixed(2);
}

function checkoutBase(request: Request): string {
  const appBase = requiredEnv("APP_BASE_URL").replace(/\/$/, "");
  const origin = request.headers.get("Origin");
  if (!origin) return appBase;

  const allow = (Deno.env.get("LOLZ_ALLOWED_CHECKOUT_ORIGINS") || appBase)
    .split(",")
    .map((item) => item.trim().replace(/\/$/, ""))
    .filter(Boolean);

  // Local checkout return is permitted only with PayPal sandbox credentials.
  if (
    Deno.env.get("PAYPAL_API_BASE") === "https://api-m.sandbox.paypal.com" &&
    /^http:\/\/(localhost|127\.0\.0\.1):5180$/.test(origin)
  ) {
    return origin;
  }

  return allow.includes(origin) ? origin : appBase;
}

async function createPayPalOrder(
  request: Request,
  admin: ReturnType<typeof createClient>,
  userId: string,
  order: JsonObject,
): Promise<JsonObject> {
  const amountCents = Number(order.amount_cents);
  const orderId = String(order.id);
  if (!Number.isInteger(amountCents) || amountCents < 100) {
    throw new HttpError("Invalid order amount", 400);
  }

  const token = await getPayPalAccessToken();
  const base = checkoutBase(request);
  const returnUrl = new URL(base);
  returnUrl.searchParams.set("page", "earn");
  returnUrl.searchParams.set("lolz_commerce", "return");
  returnUrl.searchParams.set("order_id", orderId);
  const cancelUrl = new URL(base);
  cancelUrl.searchParams.set("page", "earn");
  cancelUrl.searchParams.set("lolz_commerce", "cancel");
  cancelUrl.searchParams.set("order_id", orderId);

  const created = await paypalRequest(
    token,
    "/v2/checkout/orders",
    "POST",
    {
      intent: "CAPTURE",
      purchase_units: [{
        reference_id: orderId,
        custom_id: orderId,
        invoice_id: orderId,
        description: String(order.title || "LOLZ purchase").slice(0, 120),
        amount: { currency_code: "EUR", value: eur(amountCents) },
      }],
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: "LOLZ",
            user_action: "PAY_NOW",
            shipping_preference: "NO_SHIPPING",
            return_url: returnUrl.toString(),
            cancel_url: cancelUrl.toString(),
          },
        },
      },
    },
    crypto.randomUUID(),
  );

  const paypalOrderId = String(created.id || "");
  const links = Array.isArray(created.links) ? created.links as JsonObject[] : [];
  const approval = links.find((link) =>
    link.rel === "payer-action" || link.rel === "approve"
  );
  if (!paypalOrderId || typeof approval?.href !== "string") {
    throw new HttpError("PayPal did not return an approval link", 502);
  }

  const { error } = await admin.from("lolz_commerce_orders")
    .update({ paypal_order_id: paypalOrderId })
    .eq("id", orderId)
    .eq("buyer_id", userId)
    .eq("status", "pending");
  if (error) throw new HttpError("Could not save the PayPal order reference", 500);

  return { approval_url: approval.href, order_id: orderId };
}

async function createOfferCheckout(
  request: Request,
  admin: ReturnType<typeof createClient>,
  userId: string,
  offerId: string,
) {
  if (!offerId) throw new HttpError("Offer ID is required", 400);
  const { data: offer, error } = await admin.from("lolz_commerce_offers")
    .select("id,seller_id,offer_type,title,description,price_cents,currency,duration_days,status")
    .eq("id", offerId)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw new HttpError("Could not load this offer", 500);
  if (!offer) throw new HttpError("This offer is no longer available", 404);
  if (offer.seller_id === userId) throw new HttpError("You cannot buy your own offer", 403);

  const cents = Number(offer.price_cents);
  const fee = Math.round(cents * 0.1);
  const row = {
    buyer_id: userId,
    seller_id: offer.seller_id,
    offer_id: offer.id,
    order_type: "offer_purchase",
    title: String(offer.title),
    amount_cents: cents,
    platform_fee_cents: fee,
    seller_net_cents: cents - fee,
    currency: "EUR",
    status: "pending",
    duration_days: offer.duration_days || null,
  };
  const { data: order, error: insertError } = await admin
    .from("lolz_commerce_orders").insert(row).select("*").single();
  if (insertError || !order) throw new HttpError("Could not create the order record", 500);

  try {
    return await createPayPalOrder(request, admin, userId, order);
  } catch (error) {
    await admin.from("lolz_commerce_orders")
      .update({ status: "failed" }).eq("id", order.id).eq("buyer_id", userId);
    throw error;
  }
}

async function createTip(
  request: Request,
  admin: ReturnType<typeof createClient>,
  userId: string,
  creatorId: string,
  amountCents: number,
) {
  if (!creatorId || creatorId === userId) {
    throw new HttpError("Choose another creator to support", 400);
  }
  if (!Number.isInteger(amountCents) || amountCents < 100 || amountCents > 25000) {
    throw new HttpError("A creator tip must be between EUR 1 and EUR 250", 400);
  }
  const { data: recipient, error } = await admin
    .from("lolz_monetization_profiles")
    .select("user_id,display_name,is_public")
    .eq("user_id", creatorId)
    .eq("is_public", true)
    .maybeSingle();
  if (error) throw new HttpError("Could not verify the creator profile", 500);
  if (!recipient) throw new HttpError("This creator is not accepting public tips", 404);

  const fee = Math.round(amountCents * 0.1);
  const { data: order, error: insertError } = await admin
    .from("lolz_commerce_orders")
    .insert({
      buyer_id: userId,
      seller_id: creatorId,
      offer_id: null,
      order_type: "creator_tip",
      title: `Support for ${String(recipient.display_name).slice(0, 90)}`,
      amount_cents: amountCents,
      platform_fee_cents: fee,
      seller_net_cents: amountCents - fee,
      currency: "EUR",
      status: "pending",
    })
    .select("*")
    .single();
  if (insertError || !order) throw new HttpError("Could not create the tip record", 500);

  try {
    return await createPayPalOrder(request, admin, userId, order);
  } catch (error) {
    await admin.from("lolz_commerce_orders")
      .update({ status: "failed" }).eq("id", order.id).eq("buyer_id", userId);
    throw error;
  }
}

async function createProjectSupport(
  request: Request,
  admin: ReturnType<typeof createClient>,
  userId: string,
  amountCents: number,
) {
  if (!Number.isInteger(amountCents) || amountCents < 100 || amountCents > 25000) {
    throw new HttpError("Project support must be between EUR 1 and EUR 250", 400);
  }
  const { data: order, error } = await admin.from("lolz_commerce_orders")
    .insert({
      buyer_id: userId,
      seller_id: null,
      offer_id: null,
      order_type: "project_support",
      title: "Voluntary support for LOLZ",
      amount_cents: amountCents,
      platform_fee_cents: 0,
      seller_net_cents: 0,
      currency: "EUR",
      status: "pending",
    })
    .select("*")
    .single();
  if (error || !order) throw new HttpError("Could not create the support record", 500);
  try {
    return await createPayPalOrder(request, admin, userId, order);
  } catch (requestError) {
    await admin.from("lolz_commerce_orders")
      .update({ status: "failed" }).eq("id", order.id).eq("buyer_id", userId);
    throw requestError;
  }
}

function capturedAmount(paypalOrder: JsonObject): { amount: string; currency: string } | null {
  const units = Array.isArray(paypalOrder.purchase_units)
    ? paypalOrder.purchase_units as JsonObject[]
    : [];
  const first = units[0] || {};
  const payments = (first.payments || {}) as JsonObject;
  const captures = Array.isArray(payments.captures)
    ? payments.captures as JsonObject[]
    : [];
  const capture = captures.find((item) => String(item.status).toUpperCase() === "COMPLETED");
  if (!capture) return null;
  const amount = (capture.amount || {}) as JsonObject;
  return { amount: String(amount.value || ""), currency: String(amount.currency_code || "") };
}

async function captureOrder(
  admin: ReturnType<typeof createClient>,
  userId: string,
  orderId: string,
  paypalOrderId: string,
) {
  if (!orderId || !paypalOrderId) {
    throw new HttpError("Order reference is missing", 400);
  }
  const { data: order, error } = await admin.from("lolz_commerce_orders")
    .select("*")
    .eq("id", orderId)
    .eq("buyer_id", userId)
    .maybeSingle();
  if (error) throw new HttpError("Could not verify the order owner", 500);
  if (!order) throw new HttpError("Order not found", 404);
  if (order.status === "paid") return { status: "paid", order_id: order.id, already_paid: true };
  if (order.status !== "pending") throw new HttpError("This order is not awaiting payment", 409);
  if (!order.paypal_order_id || order.paypal_order_id !== paypalOrderId) {
    throw new HttpError("PayPal order does not match this LOLZ order", 403);
  }

  const token = await getPayPalAccessToken();
  const paypalOrder = await paypalRequest(
    token,
    `/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}`,
  );
  const units = Array.isArray(paypalOrder.purchase_units)
    ? paypalOrder.purchase_units as JsonObject[]
    : [];
  const purchaseUnit = units[0] || {};
  if (
    String(purchaseUnit.custom_id || "") !== order.id ||
    String(purchaseUnit.invoice_id || "") !== order.id
  ) {
    throw new HttpError("The PayPal order metadata does not match this purchase", 403);
  }

  let captured = paypalOrder;
  if (String(paypalOrder.status || "").toUpperCase() !== "COMPLETED") {
    if (String(paypalOrder.status || "").toUpperCase() !== "APPROVED") {
      throw new HttpError("PayPal has not approved this payment", 409);
    }
    captured = await paypalRequest(
      token,
      `/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`,
      "POST",
      {},
      crypto.randomUUID(),
    );
  }

  if (String(captured.status || "").toUpperCase() !== "COMPLETED") {
    throw new HttpError("PayPal did not complete the payment", 409);
  }
  const details = capturedAmount(captured) || capturedAmount(paypalOrder);
  if (
    !details ||
    details.currency !== "EUR" ||
    Math.round(Number(details.amount) * 100) !== Number(order.amount_cents)
  ) {
    throw new HttpError("Captured amount does not match the LOLZ order", 409);
  }

  const paidAt = new Date().toISOString();
  const { error: updateError } = await admin.from("lolz_commerce_orders")
    .update({ status: "paid", paid_at: paidAt })
    .eq("id", order.id)
    .eq("buyer_id", userId)
    .eq("status", "pending");
  if (updateError) throw new HttpError("Payment succeeded but the order status could not be saved", 500);

  if (order.order_type === "offer_purchase" && order.offer_id) {
    const expiresAt = order.duration_days
      ? new Date(Date.now() + Number(order.duration_days) * 86400000).toISOString()
      : null;
    const { error: entitlementError } = await admin.from("lolz_commerce_entitlements")
      .upsert({
        order_id: order.id,
        user_id: order.buyer_id,
        seller_id: order.seller_id,
        offer_id: order.offer_id,
        expires_at: expiresAt,
      }, { onConflict: "order_id" });
    if (entitlementError) {
      console.error("Could not create commerce entitlement for paid order", order.id, entitlementError.message);
      throw new HttpError("Payment is confirmed, but the access record needs administrator review", 500);
    }
  }

  return { status: "paid", order_id: order.id, amount_cents: order.amount_cents };
}

async function cancelOrder(
  admin: ReturnType<typeof createClient>,
  userId: string,
  orderId: string,
) {
  if (!orderId) throw new HttpError("Order ID is required", 400);
  const { data: order, error } = await admin.from("lolz_commerce_orders")
    .select("id,status")
    .eq("id", orderId)
    .eq("buyer_id", userId)
    .maybeSingle();
  if (error) throw new HttpError("Could not verify order owner", 500);
  if (!order) throw new HttpError("Order not found", 404);
  if (order.status === "paid") throw new HttpError("A paid order cannot be cancelled here", 409);
  if (order.status === "pending") {
    const { error: updateError } = await admin.from("lolz_commerce_orders")
      .update({ status: "cancelled" }).eq("id", orderId).eq("buyer_id", userId);
    if (updateError) throw new HttpError("Could not cancel this order", 500);
  }
  return { status: "cancelled", order_id: orderId };
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = requiredEnv("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
      requiredEnv("SERVICE_ROLE_KEY");
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const user = await authenticateUser(request, admin);
    let body: JsonObject;
    try {
      body = await request.json() as JsonObject;
    } catch {
      throw new HttpError("Invalid request JSON", 400);
    }

    const action = String(body.action || "");
    if (action === "create-checkout") {
      return json(await createOfferCheckout(request, admin, user.id, String(body.offer_id || "")));
    }
    if (action === "tip") {
      return json(await createTip(
        request, admin, user.id, String(body.creator_id || ""), Number(body.amount_cents),
      ));
    }
    if (action === "support") {
      return json(await createProjectSupport(request, admin, user.id, Number(body.amount_cents)));
    }
    if (action === "capture") {
      return json(await captureOrder(
        admin, user.id, String(body.order_id || ""), String(body.paypal_order_id || ""),
      ));
    }
    if (action === "cancel") {
      return json(await cancelOrder(admin, user.id, String(body.order_id || "")));
    }
    throw new HttpError("Unsupported commerce action", 400);
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    if (!(error instanceof HttpError)) console.error("LOLZ commerce function failed", error);
    return json({
      error: error instanceof Error ? error.message : "Unexpected server error",
    }, status);
  }
});
