import { createClient } from "npm:@supabase/supabase-js@2";

type JsonObject = Record<string, unknown>;
type FcmServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
};

type PushEvent = {
  type: string;
  actor_name: string;
  data: Record<string, unknown>;
  context?: {
    group_name?: string;
    channel_name?: string;
    media_type?: string;
  };
};

class HttpError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing Supabase service environment variables for lolz-push.");
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let serviceAccountCache: FcmServiceAccount | null = null;
let accessTokenCache: string | null = null;
let accessTokenExpiresAt = 0;

function json(body: JsonObject, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpError(`Missing or invalid ${label}`);
  }
  return value.trim();
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function encodeBase64Url(value: string): string {
  return toBase64Url(new TextEncoder().encode(value));
}

function getServiceAccount(): FcmServiceAccount {
  if (serviceAccountCache) return serviceAccountCache;

  const raw = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");
  if (!raw) {
    throw new HttpError("Firebase push credentials are not configured in Supabase.", 503);
  }

  let parsed: FcmServiceAccount;
  try {
    parsed = JSON.parse(raw) as FcmServiceAccount;
  } catch {
    throw new HttpError("FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.", 503);
  }

  if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
    throw new HttpError("Firebase service account is missing project_id, client_email, or private_key.", 503);
  }

  serviceAccountCache = parsed;
  return parsed;
}

async function getFcmAccessToken(): Promise<string> {
  const now = Date.now();
  if (accessTokenCache && accessTokenExpiresAt > now + 60_000) {
    return accessTokenCache;
  }

  const account = getServiceAccount();
  const issuedAt = Math.floor(now / 1000);
  const header = encodeBase64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = encodeBase64Url(JSON.stringify({
    iss: account.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: issuedAt,
    exp: issuedAt + 3600,
  }));
  const unsignedJwt = `${header}.${claims}`;

  const pem = account.private_key.replace(/\\n/g, "\n");
  const encodedKey = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");
  const keyBytes = Uint8Array.from(atob(encodedKey), (char) => char.charCodeAt(0));
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    keyBytes,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    privateKey,
    new TextEncoder().encode(unsignedJwt),
  ));
  const assertion = `${unsignedJwt}.${toBase64Url(signature)}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const result = await response.json();

  if (!response.ok || !result.access_token) {
    console.error("Firebase OAuth token request failed:", result);
    throw new HttpError("Could not authenticate with Firebase Cloud Messaging.", 502);
  }

  accessTokenCache = result.access_token as string;
  accessTokenExpiresAt = now + Number(result.expires_in || 3600) * 1000;
  return accessTokenCache;
}

function copyFor(event: PushEvent, language: string) {
  const actor = event.actor_name || (language === "ar" ? "شخص ما" : "Someone");
  const group = event.context?.group_name || (language === "ar" ? "المجموعة" : "the group");
  const channel = event.context?.channel_name || (language === "ar" ? "القناة" : "the channel");
  const video = event.context?.media_type === "video";

  if (language === "en") {
    const copies: Record<string, { title: string; body: string }> = {
      like: { title: "LOLZ", body: `${actor} liked your post.` },
      comment: { title: "LOLZ", body: `${actor} commented on your post.` },
      lolz_like: { title: "LOLZ", body: `${actor} liked your video.` },
      lolz_comment: { title: "LOLZ", body: `${actor} commented on your video.` },
      follow: { title: "New follower", body: `${actor} started following you.` },
      story_reply: { title: "Story reply", body: `${actor} replied to your story.` },
      message: { title: actor, body: "Sent you a message." },
      group_message: { title: group, body: `${actor} sent a group message.` },
      channel_post: { title: channel, body: `${actor} posted an update.` },
      incoming_call: { title: video ? "Incoming video call" : "Incoming call", body: `${actor} is calling you.` },
      missed_call: { title: "Missed call", body: `You missed a call from ${actor}.` },
      group_join: { title: group, body: `${actor} joined your group.` },
      channel_join: { title: channel, body: `${actor} subscribed to your channel.` },
    };
    return copies[event.type] || { title: "LOLZ", body: `${actor} interacted with you.` };
  }

  const copies: Record<string, { title: string; body: string }> = {
    like: { title: "LOLZ", body: `${actor} أُعجب بمنشورك.` },
    comment: { title: "LOLZ", body: `${actor} علّق على منشورك.` },
    lolz_like: { title: "LOLZ", body: `${actor} أُعجب بفيديو LOLZ الخاص بك.` },
    lolz_comment: { title: "LOLZ", body: `${actor} علّق على فيديو LOLZ الخاص بك.` },
    follow: { title: "متابع جديد", body: `${actor} بدأ بمتابعتك.` },
    story_reply: { title: "رد على قصتك", body: `${actor} ردّ على قصتك.` },
    message: { title: actor, body: "أرسل لك رسالة." },
    group_message: { title: group, body: `${actor} أرسل رسالة في المجموعة.` },
    channel_post: { title: channel, body: `${actor} نشر تحديثاً في القناة.` },
    incoming_call: { title: video ? "مكالمة فيديو واردة" : "مكالمة واردة", body: `${actor} يتصل بك الآن.` },
    missed_call: { title: "مكالمة فائتة", body: `لديك مكالمة فائتة من ${actor}.` },
    group_join: { title: group, body: `${actor} انضم إلى مجموعتك.` },
    channel_join: { title: channel, body: `${actor} اشترك في قناتك.` },
  };
  return copies[event.type] || { title: "LOLZ", body: `${actor} تفاعل معك.` };
}

function toFcmData(event: PushEvent, notificationId?: string): Record<string, string> {
  const data: Record<string, string> = { type: event.type };
  if (notificationId) data.notification_id = notificationId;

  for (const [key, value] of Object.entries(event.data || {})) {
    if (value === null || value === undefined) continue;
    data[key] = typeof value === "string" ? value : String(value);
  }

  return data;
}

async function pushAllowedByPreferences(recipientId: string, event: PushEvent): Promise<boolean> {
  const type = event.type;
  const preferenceColumn = ["like", "lolz_like"].includes(type) ? "likes_enabled"
    : ["comment", "lolz_comment", "story_reply"].includes(type) ? "comments_enabled"
    : type === "follow" ? "follows_enabled"
    : type === "message" ? "messages_enabled"
    : ["group_message", "channel_post", "group_join", "channel_join"].includes(type) ? "community_enabled"
    : ["incoming_call", "missed_call"].includes(type) ? "calls_enabled"
    : null;

  const { data: preferences, error } = await admin
    .from("lolz_notification_preferences")
    .select("*")
    .eq("user_id", recipientId)
    .maybeSingle();

  // Fail open for delivery if the optional preference row cannot be read.
  // The notification itself is already stored in the in-app inbox.
  if (error) {
    console.warn("Could not read LOLZ notification preferences; allowing push:", error.message);
    return true;
  }
  if (!preferences) return true;
  if (preferenceColumn && preferences[preferenceColumn] === false) return false;

  if (!preferences.quiet_hours_enabled || type === "incoming_call" || type === "missed_call") return true;

  const timezone = String(preferences.timezone || "Europe/Amsterdam");
  let timeParts: Intl.DateTimeFormatPart[];
  try {
    timeParts = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date());
  } catch {
    timeParts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Amsterdam",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date());
  }
  const hour = Number(timeParts.find((part) => part.type === "hour")?.value || "0");
  const minute = Number(timeParts.find((part) => part.type === "minute")?.value || "0");
  const currentMinutes = hour * 60 + minute;
  const parseMinutes = (value: string) => {
    const match = /^(\d{2}):(\d{2})/.exec(String(value || ""));
    if (!match) return null;
    const h = Number(match[1]);
    const m = Number(match[2]);
    return h < 24 && m < 60 ? h * 60 + m : null;
  };
  const start = parseMinutes(preferences.quiet_hours_start);
  const end = parseMinutes(preferences.quiet_hours_end);
  if (start === null || end === null || start === end) return true;
  const inQuietHours = start < end
    ? currentMinutes >= start && currentMinutes < end
    : currentMinutes >= start || currentMinutes < end;
  return !inQuietHours;
}

async function sendToUser(recipientId: string, event: PushEvent, notificationId?: string) {
  if (!(await pushAllowedByPreferences(recipientId, event))) {
    return { sent: 0, failed: 0 };
  }

  const { data: devices, error } = await admin
    .from("push_tokens")
    .select("token, language")
    .eq("user_id", recipientId);

  if (error) throw new HttpError("Could not load registered push devices.", 500);
  if (!devices?.length) return { sent: 0, failed: 0 };

  const account = getServiceAccount();
  const accessToken = await getFcmAccessToken();
  const isCall = event.type === "incoming_call";
  const channelId = isCall
    ? "lolz_calls"
    : ["message", "group_message"].includes(event.type)
    ? "lolz_messages"
    : "lolz_social";
  const data = toFcmData(event, notificationId);

  let sent = 0;
  let failed = 0;

  for (const device of devices) {
    const language = device.language === "en" ? "en" : "ar";
    const copy = copyFor(event, language);
    const tag = `lolz-${event.type}-${notificationId || data.call_id || data.message_id || crypto.randomUUID()}`;

    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(account.project_id)}/messages:send`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          message: {
            token: device.token,
            notification: copy,
            data,
            android: {
              priority: isCall ? "HIGH" : "NORMAL",
              ttl: isCall ? "45s" : "604800s",
              notification: {
                channel_id: channelId,
                sound: "default",
                visibility: "PRIVATE",
                priority: isCall ? "PRIORITY_MAX" : "PRIORITY_HIGH",
                tag,
              },
            },
          },
        }),
      },
    );

    const result = await response.json().catch(() => ({}));
    if (response.ok) {
      sent += 1;
      continue;
    }

    const details = Array.isArray(result?.error?.details) ? result.error.details : [];
    const isExpired = response.status === 404 ||
      result?.error?.status === "NOT_FOUND" ||
      details.some((item: JsonObject) => item.errorCode === "UNREGISTERED");

    if (isExpired) {
      await admin.from("push_tokens").delete().eq("token", device.token);
    } else {
      console.error("FCM delivery failed:", {
        status: response.status,
        error: result?.error?.message || result,
      });
    }
    failed += 1;
  }

  return { sent, failed };
}

async function getActorName(actorId: string): Promise<string> {
  const { data } = await admin
    .from("profiles")
    .select("display_name, full_name, username")
    .eq("id", actorId)
    .maybeSingle();

  return data?.display_name || data?.full_name || data?.username || "LOLZ";
}

async function createAndSendNotifications(
  recipientIds: string[],
  actorId: string,
  type: string,
  data: Record<string, unknown>,
  context: PushEvent["context"] = {},
) {
  const recipients = [...new Set(recipientIds)].filter((id) => id && id !== actorId);
  const actorName = await getActorName(actorId);
  let notificationsCreated = 0;
  let pushesSent = 0;

  for (const recipientId of recipients) {
    const sourceObjectId =
      data.message_id || data.post_id || data.call_id ||
      data.comment_id || data.video_id ||
      data.group_id || data.channel_id || crypto.randomUUID();
    const row = {
      recipient_id: recipientId,
      actor_id: actorId,
      type,
      data,
      source_event_key: `${type}:${String(sourceObjectId)}:${recipientId}:${actorId}`,
    };
    const { data: notification, error } = await admin
      .from("notifications")
      .insert(row)
      .select("id")
      .single();

    if (error?.code === "23505") {
      // The same server event was already recorded and delivered.
      continue;
    }

    if (error || !notification?.id) {
      console.error("Could not save LOLZ notification:", error);
      continue;
    }

    notificationsCreated += 1;
    const result = await sendToUser(
      recipientId,
      { type, actor_name: actorName, data, context },
      String(notification.id),
    );
    pushesSent += result.sent;
  }

  return { notifications_created: notificationsCreated, pushes_sent: pushesSent };
}

async function getCallParticipants(call: JsonObject): Promise<string[]> {
  const callType = String(call.call_type || "");

  if (callType === "private") {
    const conversationId = requireString(call.conversation_id, "call conversation");
    const { data, error } = await admin
      .from("conversations")
      .select("user_one, user_two")
      .eq("id", conversationId)
      .maybeSingle();

    if (error || !data) throw new HttpError("Could not find the call conversation.", 404);
    return [data.user_one, data.user_two].filter(Boolean);
  }

  if (callType === "group") {
    const groupId = requireString(call.group_id, "call group");
    const [{ data: members, error }, { data: group, error: groupError }] = await Promise.all([
      admin.from("group_members").select("user_id").eq("group_id", groupId),
      admin.from("groups").select("created_by").eq("id", groupId).maybeSingle(),
    ]);

    if (error || groupError) throw new HttpError("Could not load group call recipients.", 500);
    return [...new Set([
      ...(members || []).map((row: JsonObject) => String(row.user_id)),
      ...(group?.created_by ? [String(group.created_by)] : []),
    ])];
  }

  if (callType === "channel") {
    const channelId = requireString(call.channel_id, "call channel");
    const [{ data: members, error }, { data: channel, error: channelError }] = await Promise.all([
      admin.from("channel_members").select("user_id").eq("channel_id", channelId),
      admin.from("channels").select("created_by").eq("id", channelId).maybeSingle(),
    ]);

    if (error || channelError) throw new HttpError("Could not load channel call recipients.", 500);
    return [...new Set([
      ...(members || []).map((row: JsonObject) => String(row.user_id)),
      ...(channel?.created_by ? [String(channel.created_by)] : []),
    ])];
  }

  throw new HttpError("Unsupported call type.");
}

async function handleAction(userId: string, body: JsonObject) {
  const action = requireString(body.action, "action");

  if (action === "social_event") {
    const recipientId = requireString(body.recipient_id, "notification recipient");
    const type = requireString(body.type, "notification type");
    let eventData: Record<string, unknown> = {};
    let postId: string | null = null;

    if (recipientId === userId) {
      throw new HttpError("You cannot notify yourself.", 400);
    }

    if (type === "lolz_like" || type === "lolz_comment") {
      const videoId = requireString(body.video_id, "LOLZ video id");
      const { data: video, error: videoError } = await admin
        .from("lolz_videos")
        .select("id, user_id")
        .eq("id", videoId)
        .maybeSingle();

      if (videoError || !video) {
        throw new HttpError("LOLZ video was not found.", 404);
      }

      if (String(video.user_id) === userId) {
        return { success: true, notifications_created: 0, pushes_sent: 0 };
      }

      const eventData: Record<string, unknown> = { video_id: videoId };

      if (type === "lolz_like") {
        const { data: like, error: likeError } = await admin
          .from("lolz_likes")
          .select("video_id")
          .eq("video_id", videoId)
          .eq("user_id", userId)
          .maybeSingle();

        if (likeError || !like) {
          throw new HttpError("The LOLZ video like could not be verified.", 403);
        }
      } else {
        const { data: comment, error: commentError } = await admin
          .from("lolz_comments")
          .select("id")
          .eq("video_id", videoId)
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (commentError || !comment) {
          throw new HttpError("The LOLZ video comment could not be verified.", 403);
        }
        eventData.comment_id = String(comment.id);
      }

      const result = await createAndSendNotifications(
        [String(video.user_id)],
        userId,
        type,
        eventData,
      );
      return { success: true, ...result };
    }

    if (type === "like" || type === "comment") {
      postId = requireString(body.post_id, "post id");

      const { data: post, error: postError } = await admin
        .from("posts")
        .select("id, user_id")
        .eq("id", postId)
        .maybeSingle();

      if (postError || !post || String(post.user_id) !== recipientId) {
        throw new HttpError("Notification recipient does not own this post.", 403);
      }

      if (type === "like") {
        const { data: like, error: likeError } = await admin
          .from("post_likes")
          .select("post_id")
          .eq("post_id", postId)
          .eq("user_id", userId)
          .maybeSingle();

        if (likeError || !like) {
          throw new HttpError("The like could not be verified.", 403);
        }
      } else {
        const { data: comment, error: commentError } = await admin
          .from("comments")
          .select("id")
          .eq("post_id", postId)
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (commentError || !comment) {
          throw new HttpError("The comment could not be verified.", 403);
        }
        eventData.comment_id = String(comment.id);
      }

      eventData.post_id = postId;
    } else if (type === "follow") {
      const { data: follow, error: followError } = await admin
        .from("follows")
        .select("follower_id")
        .eq("follower_id", userId)
        .eq("following_id", recipientId)
        .maybeSingle();

      if (followError || !follow) {
        throw new HttpError("The follow relationship could not be verified.", 403);
      }
    } else {
      throw new HttpError("Unsupported social notification type.", 400);
    }

    let query = admin
      .from("notifications")
      .select("id")
      .eq("recipient_id", recipientId)
      .eq("actor_id", userId)
      .eq("type", type)
      .order("created_at", { ascending: false })
      .limit(1);

    query = postId ? query.eq("post_id", postId) : query.is("post_id", null);

    const { data: notification, error: notificationError } = await query.maybeSingle();
    if (notificationError || !notification) {
      throw new HttpError("The in-app notification was not found.", 404);
    }

    const actorName = await getActorName(userId);
    const result = await sendToUser(
      recipientId,
      { type, actor_name: actorName, data: eventData },
      String(notification.id),
    );

    return { success: true, ...result };
  }

  if (action === "notification") {
    const notificationId = requireString(body.notification_id, "notification id");
    const { data: notification, error } = await admin
      .from("notifications")
      .select("id, recipient_id, actor_id, type, post_id, data")
      .eq("id", notificationId)
      .maybeSingle();

    if (error || !notification) throw new HttpError("Notification not found.", 404);
    if (notification.actor_id !== userId || notification.recipient_id === userId) {
      throw new HttpError("You cannot dispatch this notification.", 403);
    }

    const actorName = await getActorName(userId);
    const eventData = {
      ...(notification.data && typeof notification.data === "object" ? notification.data : {}),
      post_id: notification.post_id || undefined,
    } as Record<string, unknown>;
    const result = await sendToUser(
      String(notification.recipient_id),
      { type: String(notification.type), actor_name: actorName, data: eventData },
      String(notification.id),
    );
    return { success: true, ...result };
  }

  if (action === "direct_message") {
    const messageId = requireString(body.message_id, "message id");
    const { data: message, error } = await admin
      .from("messages")
      .select("id, conversation_id, sender_id, message_type")
      .eq("id", messageId)
      .maybeSingle();

    if (error || !message) throw new HttpError("Message not found.", 404);
    if (message.sender_id !== userId) throw new HttpError("Message sender does not match.", 403);

    const { data: conversation, error: conversationError } = await admin
      .from("conversations")
      .select("user_one, user_two")
      .eq("id", message.conversation_id)
      .maybeSingle();

    if (conversationError || !conversation) throw new HttpError("Conversation not found.", 404);
    const recipientId = conversation.user_one === userId
      ? conversation.user_two
      : conversation.user_one;
    const notificationType = body.story_reply === true ? "story_reply" : "message";
    const result = await createAndSendNotifications(
      [String(recipientId)],
      userId,
      notificationType,
      { conversation_id: String(message.conversation_id), message_id: String(message.id) },
    );
    return { success: true, ...result };
  }

  if (action === "group_message") {
    const messageId = requireString(body.message_id, "group message id");
    const { data: message, error } = await admin
      .from("group_messages")
      .select("id, group_id, sender_id")
      .eq("id", messageId)
      .maybeSingle();

    if (error || !message) throw new HttpError("Group message not found.", 404);
    if (message.sender_id !== userId) throw new HttpError("Message sender does not match.", 403);

    const [{ data: members, error: membersError }, { data: group }] = await Promise.all([
      admin.from("group_members").select("user_id").eq("group_id", message.group_id),
      admin.from("groups").select("name, created_by").eq("id", message.group_id).maybeSingle(),
    ]);
    if (membersError) throw new HttpError("Could not load group recipients.", 500);

    const result = await createAndSendNotifications(
      [...new Set([
        ...(members || []).map((row: JsonObject) => String(row.user_id)),
        ...(group?.created_by ? [String(group.created_by)] : []),
      ])],
      userId,
      "group_message",
      { group_id: String(message.group_id), message_id: String(message.id) },
      { group_name: group?.name || undefined },
    );
    return { success: true, ...result };
  }

  if (action === "channel_post") {
    const postId = requireString(body.post_id, "channel post id");
    const { data: post, error } = await admin
      .from("channel_posts")
      .select("id, channel_id, sender_id")
      .eq("id", postId)
      .maybeSingle();

    if (error || !post) throw new HttpError("Channel post not found.", 404);
    if (post.sender_id !== userId) throw new HttpError("Post sender does not match.", 403);

    const [{ data: members, error: membersError }, { data: channel }] = await Promise.all([
      admin.from("channel_members").select("user_id").eq("channel_id", post.channel_id),
      admin.from("channels").select("name, created_by").eq("id", post.channel_id).maybeSingle(),
    ]);
    if (membersError) throw new HttpError("Could not load channel recipients.", 500);

    const result = await createAndSendNotifications(
      [...new Set([
        ...(members || []).map((row: JsonObject) => String(row.user_id)),
        ...(channel?.created_by ? [String(channel.created_by)] : []),
      ])],
      userId,
      "channel_post",
      { channel_id: String(post.channel_id), post_id: String(post.id) },
      { channel_name: channel?.name || undefined },
    );
    return { success: true, ...result };
  }

  if (action === "call" || action === "missed_call") {
    const callId = requireString(body.call_id, "call id");
    const { data: call, error } = await admin
      .from("lolz_calls")
      .select("id, call_type, media_type, conversation_id, group_id, channel_id, created_by")
      .eq("id", callId)
      .maybeSingle();

    if (error || !call) throw new HttpError("Call not found.", 404);
    const participants = await getCallParticipants(call as JsonObject);
    const creatorId = String(call.created_by);

    if (action === "call") {
      if (creatorId !== userId) throw new HttpError("Only the call creator can send an invite.", 403);
      const context: PushEvent["context"] = { media_type: String(call.media_type || "audio") };
      if (call.call_type === "group" && call.group_id) {
        const { data } = await admin.from("groups").select("name").eq("id", call.group_id).maybeSingle();
        context.group_name = data?.name || undefined;
      }
      if (call.call_type === "channel" && call.channel_id) {
        const { data } = await admin.from("channels").select("name").eq("id", call.channel_id).maybeSingle();
        context.channel_name = data?.name || undefined;
      }
      const result = await createAndSendNotifications(
        participants,
        userId,
        "incoming_call",
        {
          call_id: String(call.id),
          call_type: String(call.call_type),
          media_type: String(call.media_type || "audio"),
          conversation_id: call.conversation_id ? String(call.conversation_id) : "",
          group_id: call.group_id ? String(call.group_id) : "",
          channel_id: call.channel_id ? String(call.channel_id) : "",
        },
        context,
      );
      return { success: true, ...result };
    }

    if (creatorId === userId || !participants.includes(userId)) {
      throw new HttpError("Only an invited participant can report a missed call.", 403);
    }

    const result = await createAndSendNotifications(
      [creatorId],
      userId,
      "missed_call",
      {
        call_id: String(call.id),
        call_type: String(call.call_type),
        conversation_id: call.conversation_id ? String(call.conversation_id) : "",
      },
    );
    return { success: true, ...result };
  }

  if (action === "group_join") {
    const groupId = requireString(body.group_id, "group id");
    const { data: membership } = await admin
      .from("group_members")
      .select("user_id")
      .eq("group_id", groupId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!membership) throw new HttpError("You are not a member of this group.", 403);

    const [{ data: admins, error: adminsError }, { data: group }] = await Promise.all([
      admin.from("group_members").select("user_id").eq("group_id", groupId).in("role", ["owner", "admin"]),
      admin.from("groups").select("name, created_by").eq("id", groupId).maybeSingle(),
    ]);
    if (adminsError) throw new HttpError("Could not load group administrators.", 500);

    const result = await createAndSendNotifications(
      [...new Set([
        ...(admins || []).map((row: JsonObject) => String(row.user_id)),
        ...(group?.created_by ? [String(group.created_by)] : []),
      ])],
      userId,
      "group_join",
      { group_id: groupId },
      { group_name: group?.name || undefined },
    );
    return { success: true, ...result };
  }

  if (action === "channel_join") {
    const channelId = requireString(body.channel_id, "channel id");
    const [{ data: channel, error: channelError }, { data: membership }] = await Promise.all([
      admin.from("channels").select("id, name, created_by").eq("id", channelId).maybeSingle(),
      admin.from("channel_members").select("user_id").eq("channel_id", channelId).eq("user_id", userId).maybeSingle(),
    ]);

    if (channelError || !channel) throw new HttpError("Channel not found.", 404);
    if (!membership) throw new HttpError("You are not subscribed to this channel.", 403);

    const result = await createAndSendNotifications(
      [String(channel.created_by)],
      userId,
      "channel_join",
      { channel_id: channelId },
      { channel_name: channel.name || undefined },
    );
    return { success: true, ...result };
  }

  throw new HttpError("Unsupported LOLZ push action.", 400);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const authorization = req.headers.get("Authorization") || "";
    const jwt = authorization.replace(/^Bearer\s+/i, "");
    if (!jwt) throw new HttpError("Authentication is required.", 401);

    const { data: authData, error: authError } = await admin.auth.getUser(jwt);
    if (authError || !authData.user) throw new HttpError("Invalid user session.", 401);

    const body = await req.json() as JsonObject;
    const result = await handleAction(authData.user.id, body);
    return json(result as JsonObject);
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Unexpected push notification error.";
    if (status >= 500) console.error("LOLZ push function error:", error);
    return json({ error: message }, status);
  }
});
