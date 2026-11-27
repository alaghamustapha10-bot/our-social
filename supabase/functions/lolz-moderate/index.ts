import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const BLOCKED_CATEGORIES = [
  "sexual",
  "sexual/minors",
  "hate",
  "hate/threatening",
  "harassment",
  "harassment/threatening",
  "violence",
  "violence/graphic",
  "self-harm",
  "self-harm/intent",
  "self-harm/instructions",
  "illicit",
  "illicit/violent",
] as const;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authorization = req.headers.get("Authorization") || "";
    const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return json({ error: "Authentication required" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) return json({ error: "Server authentication is not configured." }, 500);

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData?.user) return json({ error: "Your session is invalid. Sign in again." }, 401);

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    const body = await req.json().catch(() => ({}));
    const text = String(body?.text || "").slice(0, 5000);
    const language = body?.language === "ar" ? "ar" : "en";
    const rawImages = Array.isArray(body?.image_data_urls) ? body.image_data_urls : [];

    if (rawImages.length > 4) return json({ error: "A maximum of four media frames can be checked." }, 400);
    const imageUrls: string[] = [];
    for (const raw of rawImages) {
      if (typeof raw !== "string" || !raw.startsWith("data:image/jpeg;base64,")) {
        return json({ error: "The media review payload contains an unsupported image format." }, 400);
      }
      if (raw.length > 2_500_000) return json({ error: "A media review frame is too large." }, 413);
      imageUrls.push(raw);
    }

    if (!apiKey) {
      return json({
        enabled: false,
        approved: imageUrls.length === 0,
        code: "moderation_not_configured",
        ...(imageUrls.length ? {
          error: "Image and video screening is not configured. Add OPENAI_API_KEY in Supabase Edge Function secrets before uploading media.",
        } : {}),
      });
    }

    if (!text.trim() && imageUrls.length === 0) {
      return json({ enabled: true, approved: true, categories: [] });
    }

    const input: Array<Record<string, unknown>> = [];
    if (text.trim()) input.push({ type: "text", text });
    for (const imageUrl of imageUrls) {
      input.push({ type: "image_url", image_url: { url: imageUrl } });
    }

    const response = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "omni-moderation-latest",
        input,
      }),
    });

    if (!response.ok) {
      const providerError = await response.json().catch(() => null);
      const message = providerError?.error?.message || `Moderation service returned HTTP ${response.status}.`;
      console.error("OpenAI moderation request failed:", message);
      return json({
        error: "The safety review service is temporarily unavailable. The media was not approved.",
        code: "moderation_provider_error",
      }, 502);
    }

    const result = await response.json();
    const results = Array.isArray(result?.results) ? result.results : [];
    const categories = new Set<string>();
    for (const item of results) {
      const itemCategories = item?.categories || {};
      for (const category of BLOCKED_CATEGORIES) {
        if (itemCategories[category] === true) categories.add(category);
      }
    }

    if (categories.size) {
      const found = [...categories];
      const message = language === "ar"
        ? "لم يُسمح بنشر هذا المحتوى لأنه لا يتوافق مع قواعد مجتمع LOLZ."
        : "This content was not approved because it does not comply with LOLZ community guidelines.";
      return json({
        enabled: true,
        approved: false,
        code: "policy_violation",
        categories: found,
        message,
      });
    }

    return json({
      enabled: true,
      approved: true,
      categories: [],
    });
  } catch (error) {
    console.error("lolz-moderate error:", error);
    return json({ error: "The safety review could not be completed. Please try again." }, 500);
  }
});
