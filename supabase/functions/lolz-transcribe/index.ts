import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

type SourceType = "message" | "group_message" | "channel_post";
type Row = Record<string, unknown>;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Row, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function cleanId(value: unknown): string {
  if (typeof value !== "string" && typeof value !== "number") return "";
  return String(value).trim().slice(0, 100);
}

function decodeStoragePath(value: string): string {
  return value.split("/").map((part) => decodeURIComponent(part)).join("/");
}

async function downloadAudio(
  admin: ReturnType<typeof createClient>,
  supabaseUrl: string,
  sourceType: SourceType,
  mediaUrl: string,
): Promise<{ blob: Blob; filename: string }> {
  if (sourceType === "message") {
    if (/^https?:\/\//i.test(mediaUrl)) {
      throw new Error("This private voice message has an invalid media reference.");
    }
    const path = decodeStoragePath(mediaUrl.replace(/^\/+/, ""));
    const { data, error } = await admin.storage.from("private-messages").download(path);
    if (error || !data) throw new Error("Could not read the private voice message.");
    return { blob: data, filename: path.split("/").pop() || "voice-message.webm" };
  }

  let parsed: URL;
  try {
    parsed = new URL(mediaUrl);
  } catch {
    throw new Error("The audio media URL is invalid.");
  }

  const expected = new URL(supabaseUrl);
  const marker = "/storage/v1/object/public/social-media/";
  if (parsed.origin !== expected.origin || !parsed.pathname.includes(marker)) {
    throw new Error("The audio source is not an allowed LOLZ media file.");
  }

  const storedPath = decodeStoragePath(parsed.pathname.split(marker)[1] || "");
  if (!storedPath || storedPath.startsWith("/") || storedPath.split("/").includes("..")) {
    throw new Error("The audio storage path is invalid.");
  }
  const { data, error } = await admin.storage.from("social-media").download(storedPath);
  if (error || !data) throw new Error("Could not read this voice message.");
  return { blob: data, filename: storedPath.split("/").pop() || "voice-message.webm" };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authorization = req.headers.get("Authorization") || "";
    const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return json({ error: "Authentication required." }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY") || "";
    const apiKey = Deno.env.get("OPENAI_API_KEY") || "";
    if (!supabaseUrl || !serviceKey) return json({ error: "Server authentication is not configured." }, 500);
    if (!apiKey) return json({
      error: "Voice transcription is not configured. Add OPENAI_API_KEY to Supabase Edge Function secrets.",
      code: "transcription_not_configured",
    }, 503);

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    const user = authData?.user;
    if (authError || !user?.id) return json({ error: "Your session is invalid. Sign in again." }, 401);

    const body = await req.json().catch(() => ({}));
    const sourceType = String(body?.source_type || "") as SourceType;
    const messageId = cleanId(body?.message_id);
    const language = body?.language === "ar" ? "ar" : body?.language === "en" ? "en" : "";

    if (!["message", "group_message", "channel_post"].includes(sourceType) || !messageId) {
      return json({ error: "A valid audio message and source type are required." }, 400);
    }

    const table = sourceType === "message" ? "messages"
      : sourceType === "group_message" ? "group_messages"
      : "channel_posts";
    const { data: message, error: messageError } = await admin
      .from(table)
      .select("*")
      .eq("id", messageId)
      .maybeSingle();
    if (messageError || !message) return json({ error: "Voice message not found." }, 404);
    if (message.message_type !== "audio" || !message.media_url) {
      return json({ error: "This item is not an available voice message." }, 400);
    }
    if (message.transcript && String(message.transcript).trim()) {
      return json({ transcript: message.transcript, cached: true });
    }

    if (sourceType === "message") {
      const { data: conversation, error } = await admin
        .from("conversations")
        .select("user_one,user_two")
        .eq("id", message.conversation_id)
        .maybeSingle();
      if (error || !conversation || ![conversation.user_one, conversation.user_two].includes(user.id)) {
        return json({ error: "You are not a participant in this private conversation." }, 403);
      }
    } else if (sourceType === "group_message") {
      const { data: membership, error } = await admin
        .from("group_members")
        .select("user_id")
        .eq("group_id", message.group_id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (error || !membership) return json({ error: "You are not a member of this group." }, 403);
    } else {
      const [{ data: membership }, { data: channel }] = await Promise.all([
        admin.from("channel_members").select("user_id").eq("channel_id", message.channel_id).eq("user_id", user.id).maybeSingle(),
        admin.from("channels").select("created_by").eq("id", message.channel_id).maybeSingle(),
      ]);
      if (!membership && channel?.created_by !== user.id) {
        return json({ error: "You are not allowed to view this channel voice message." }, 403);
      }
    }

    const { blob, filename } = await downloadAudio(admin, supabaseUrl, sourceType, String(message.media_url));
    if (blob.size === 0) return json({ error: "The voice message is empty." }, 400);
    if (blob.size > 25 * 1024 * 1024) {
      return json({ error: "Audio files must be 25 MB or smaller for transcription." }, 413);
    }

    const form = new FormData();
    const audioFile = new File([blob], filename, {
      type: blob.type || (filename.toLowerCase().endsWith(".mp3") ? "audio/mpeg" : "audio/webm"),
    });
    form.append("file", audioFile);
    form.append("model", "whisper-1");
    if (language) form.append("language", language);

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || typeof result?.text !== "string" || !result.text.trim()) {
      console.error("LOLZ voice transcription failed:", response.status, result?.error?.message || "Unknown error");
      return json({
        error: response.status === 401
          ? "The configured OpenAI API key was rejected."
          : response.status === 429
          ? "OpenAI transcription quota or rate limit was reached."
          : "Could not transcribe this audio right now.",
      }, response.status === 429 ? 429 : 502);
    }

    const transcript = String(result.text).trim().slice(0, 12000);
    const { error: saveError } = await admin
      .from(table)
      .update({ transcript })
      .eq("id", messageId);
    if (saveError) {
      console.error("Could not save LOLZ transcript:", saveError.message);
      return json({ error: "The transcript was created but could not be saved." }, 500);
    }

    return json({ transcript, cached: false });
  } catch (error) {
    console.error("LOLZ transcription request failed:", error);
    return json({ error: error instanceof Error ? error.message : "Unexpected transcription error." }, 500);
  }
});
