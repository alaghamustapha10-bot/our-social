import { createClient } from "npm:@supabase/supabase-js@2";
import {
  AccessToken,
  RoomServiceClient,
  EgressClient,
  EncodedFileOutput,
  S3Upload,
} from "npm:livekit-server-sdk";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const RECORDING_BUCKET = "lolz-call-recordings";

const ACTIVE_RECORDING_STATUSES = [
  "consent_pending",
  "starting",
  "recording",
];

type JsonObject = Record<string, unknown>;

type CallParticipant = {
  id: string;
  call_id: string;
  user_id: string;
  can_publish: boolean | null;
  can_subscribe: boolean | null;
};

class HttpError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

function response(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function logError(
  label: string,
  error: unknown,
  requestId: string,
): void {
  const value = error as {
    message?: string;
    code?: string;
    details?: string;
    hint?: string;
  } | null;

  console.error(label, {
    request_id: requestId,
    message: value?.message || String(error),
    code: value?.code || null,
    details: value?.details || null,
    hint: value?.hint || null,
  });
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(value);
}

function getUniqueParticipantIds(
  participants: Array<{ user_id: unknown }>,
): string[] {
  const ids = participants
    .map((participant) => participant.user_id)
    .filter(
      (id): id is string =>
        typeof id === "string" && id.length > 0,
    );

  return [...new Set<string>(ids)];
}

function isOneOf(
  value: unknown,
  allowed: readonly string[],
): value is string {
  return typeof value === "string" && allowed.includes(value);
}

Deno.serve(async (req: Request): Promise<Response> => {
  const requestId = crypto.randomUUID();

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return response({
      success: false,
      error: "Method not allowed",
      request_id: requestId,
    }, 405);
  }

  try {
    // ==================================================
    // SERVER CONFIGURATION
    // ==================================================

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE_KEY = Deno.env.get(
      "SUPABASE_SERVICE_ROLE_KEY",
    );
    const LIVEKIT_URL = Deno.env.get("LIVEKIT_URL");
    const LIVEKIT_API_KEY = Deno.env.get("LIVEKIT_API_KEY");
    const LIVEKIT_API_SECRET = Deno.env.get(
      "LIVEKIT_API_SECRET",
    );

    if (
      !SUPABASE_URL ||
      !SERVICE_ROLE_KEY ||
      !LIVEKIT_URL ||
      !LIVEKIT_API_KEY ||
      !LIVEKIT_API_SECRET
    ) {
      throw new HttpError(
        "Server configuration missing",
        500,
      );
    }

    // ==================================================
    // AUTHENTICATION
    // ==================================================

    const authorization = req.headers.get("Authorization");

    if (!authorization?.startsWith("Bearer ")) {
      throw new HttpError("Authentication required", 401);
    }

    const jwt = authorization.slice(7).trim();

    if (!jwt) {
      throw new HttpError(
        "Invalid authentication token",
        401,
      );
    }

    const supabase = createClient(
      SUPABASE_URL,
      SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(jwt);

    if (authError || !user) {
      logError(
        "Authentication failed",
        authError,
        requestId,
      );

      throw new HttpError(
        "Your session is invalid or expired. Please sign in again.",
        401,
      );
    }

    const userId = user.id;

    // ==================================================
    // REQUEST BODY
    // ==================================================

    let body: JsonObject;

    try {
      const parsed: unknown = await req.json();

      if (
        !parsed ||
        typeof parsed !== "object" ||
        Array.isArray(parsed)
      ) {
        throw new HttpError(
          "Invalid request body",
          400,
        );
      }

      body = parsed as JsonObject;
    } catch (error) {
      if (error instanceof HttpError) throw error;

      throw new HttpError(
        "Invalid JSON request body",
        400,
      );
    }

    const action = body.action;
    const call_id = body.call_id;
    const call_type = body.call_type;
    const conversation_id = body.conversation_id;
    const group_id = body.group_id;
    const channel_id = body.channel_id;
    const target_user_id = body.target_user_id;
    const can_publish = body.can_publish;
    const call_mode = body.call_mode;
    const decision = body.decision;
    const media_type = body.media_type;
    const speakRequestId = body.request_id;

    if (typeof action !== "string" || !action.trim()) {
      throw new HttpError("Action is required", 400);
    }

    console.log("LiveKit request", {
      request_id: requestId,
      action,
      call_type: call_type || null,
      user_id: userId,
    });

    // ==================================================
    // LIVEKIT CLIENTS
    // ==================================================

    const livekitHost = LIVEKIT_URL
      .replace(/^wss:/, "https:")
      .replace(/^ws:/, "http:")
      .replace(/\/$/, "");

    const roomService = new RoomServiceClient(
      livekitHost,
      LIVEKIT_API_KEY,
      LIVEKIT_API_SECRET,
    );

    const egressClient = new EgressClient(
      livekitHost,
      LIVEKIT_API_KEY,
      LIVEKIT_API_SECRET,
    );

    // ==================================================
    // MEMBERSHIP CHECK
    // ==================================================

    async function checkMembership(
      call: Record<string, any>,
      targetUserId = userId,
    ): Promise<boolean> {
      if (call.call_type === "private") {
        const { data, error } = await supabase
          .from("conversations")
          .select("id")
          .eq("id", call.conversation_id)
          .or(
            `user_one.eq.${targetUserId},user_two.eq.${targetUserId}`,
          )
          .maybeSingle();

        if (error) {
          logError(
            "Private membership check failed",
            error,
            requestId,
          );
          throw new HttpError(
            "Could not verify conversation membership",
          );
        }

        return !!data;
      }

      if (call.call_type === "group") {
        const { data, error } = await supabase
          .from("group_members")
          .select("group_id")
          .eq("group_id", call.group_id)
          .eq("user_id", targetUserId)
          .maybeSingle();

        if (error) {
          logError(
            "Group membership check failed",
            error,
            requestId,
          );
          throw new HttpError(
            "Could not verify group membership",
          );
        }

        return !!data;
      }

      if (call.call_type === "channel") {
        const { data, error } = await supabase
          .from("channel_members")
          .select("channel_id")
          .eq("channel_id", call.channel_id)
          .eq("user_id", targetUserId)
          .maybeSingle();

        if (error) {
          logError(
            "Channel membership check failed",
            error,
            requestId,
          );
          throw new HttpError(
            "Could not verify channel membership",
          );
        }

        return !!data;
      }

      return false;
    }

    // ==================================================
    // ROLE CHECK
    // ==================================================

    async function getRole(
      call: Record<string, any>,
    ): Promise<string | null> {
      if (call.call_type === "group") {
        const { data, error } = await supabase
          .from("group_members")
          .select("role")
          .eq("group_id", call.group_id)
          .eq("user_id", userId)
          .maybeSingle();

        if (error) {
          logError(
            "Group role check failed",
            error,
            requestId,
          );
          throw new HttpError(
            "Could not verify group permissions",
          );
        }

        return data?.role || null;
      }

      if (call.call_type === "channel") {
        const { data, error } = await supabase
          .from("channel_members")
          .select("role")
          .eq("channel_id", call.channel_id)
          .eq("user_id", userId)
          .maybeSingle();

        if (error) {
          logError(
            "Channel role check failed",
            error,
            requestId,
          );
          throw new HttpError(
            "Could not verify channel permissions",
          );
        }

        return data?.role || null;
      }

      return null;
    }

    async function isAdmin(
      call: Record<string, any>,
    ): Promise<boolean> {
      const role = await getRole(call);
      return role === "owner" || role === "admin";
    }

    // Both owners and admins can manage group/channel recordings.
    async function requireRecordingManager(
      call: Record<string, any>,
    ): Promise<void> {
      if (
        call.call_type !== "group" &&
        call.call_type !== "channel"
      ) {
        throw new HttpError(
          "Recording is only available in group and channel calls",
          400,
        );
      }

      if (!(await isAdmin(call))) {
        throw new HttpError(
          "Only the group or channel owner and admins can manage recordings",
          403,
        );
      }
    }

    // ==================================================
    // GET CALL
    // ==================================================

    async function getCall(): Promise<Record<string, any>> {
      if (!isUuid(call_id)) {
        throw new HttpError(
          "A valid call_id is required",
          400,
        );
      }

      const { data, error } = await supabase
        .from("lolz_calls")
        .select("*")
        .eq("id", call_id)
        .maybeSingle();

      if (error) {
        logError("Get call failed", error, requestId);
        throw new HttpError("Could not load call");
      }

      if (!data) {
        throw new HttpError("Call not found", 404);
      }

      return data;
    }

    // ==================================================
    // GET CALL MODE
    // ==================================================

    async function getCallMode(
      call: Record<string, any>,
    ): Promise<string> {
      if (call.call_type === "group") {
        const { data, error } = await supabase
          .from("groups")
          .select("call_mode")
          .eq("id", call.group_id)
          .maybeSingle();

        if (error) {
          logError(
            "Get group call mode failed",
            error,
            requestId,
          );
          throw new HttpError(
            "Could not load group call settings",
          );
        }

        return data?.call_mode === "moderated"
          ? "moderated"
          : "open";
      }

      if (call.call_type === "channel") {
        const { data, error } = await supabase
          .from("channels")
          .select("call_mode")
          .eq("id", call.channel_id)
          .maybeSingle();

        if (error) {
          logError(
            "Get channel call mode failed",
            error,
            requestId,
          );
          throw new HttpError(
            "Could not load channel call settings",
          );
        }

        return data?.call_mode === "moderated"
          ? "moderated"
          : "open";
      }

      return "open";
    }

    // ==================================================
    // CREATE LIVEKIT TOKEN
    // ==================================================

    async function createToken(
      roomName: string,
      canPublish: boolean,
    ): Promise<string> {
      const token = new AccessToken(
        LIVEKIT_API_KEY,
        LIVEKIT_API_SECRET,
        {
          identity: userId,
          ttl: "1h",
        },
      );

      token.addGrant({
        roomJoin: true,
        room: roomName,
        canSubscribe: true,
        canPublish,
        canPublishData: true,
      });

      return await token.toJwt();
    }

    // ==================================================
    // UPDATE LIVEKIT PERMISSION
    // ==================================================

    async function updateLiveKitPermission(
      roomName: string,
      targetUserId: string,
      canPublish: boolean,
    ): Promise<void> {
      await roomService.updateParticipant(
        roomName,
        targetUserId,
        {
          permission: {
            canPublish,
            canSubscribe: true,
            canPublishData: true,
          },
        },
      );
    }

    // ==================================================
    // RECORDING HELPERS
    // ==================================================

    async function getActiveRecording(
      callId: string,
    ): Promise<Record<string, any> | null> {
      const { data, error } = await supabase
        .from("lolz_call_recordings")
        .select("*")
        .eq("call_id", callId)
        .in("status", ACTIVE_RECORDING_STATUSES)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        logError(
          "Get active recording failed",
          error,
          requestId,
        );
        throw new HttpError(
          "Could not load recording status",
        );
      }

      return data;
    }

    async function getRecordingConsents(
      callId: string,
    ): Promise<any[]> {
      const { data, error } = await supabase
        .from("lolz_call_recording_consents")
        .select(
          "id, call_id, user_id, decision, responded_at",
        )
        .eq("call_id", callId);

      if (error) {
        logError(
          "Get recording consents failed",
          error,
          requestId,
        );
        throw new HttpError(
          "Could not load recording consents",
        );
      }

      return data || [];
    }

    async function getActiveParticipants(
      callId: string,
    ): Promise<CallParticipant[]> {
      const { data, error } = await supabase
        .from("lolz_call_participants")
        .select(
          "id, call_id, user_id, can_publish, can_subscribe",
        )
        .eq("call_id", callId)
        .is("left_at", null);

      if (error) {
        logError(
          "Get active participants failed",
          error,
          requestId,
        );
        throw new HttpError(
          "Could not load call participants",
        );
      }

      return (data || []) as CallParticipant[];
    }

    async function cancelRecording(
      recordingId: string,
    ): Promise<void> {
      const { error } = await supabase
        .from("lolz_call_recordings")
        .update({
          status: "cancelled",
          ended_at: new Date().toISOString(),
        })
        .eq("id", recordingId)
        .in("status", ["consent_pending", "starting"]);

      if (error) {
        logError(
          "Cancel recording failed",
          error,
          requestId,
        );
        throw new HttpError("Could not cancel recording");
      }
    }

    async function stopRecordingForCall(
      call: Record<string, any>,
    ): Promise<void> {
      const recording = await getActiveRecording(call.id);

      if (!recording) return;

      if (recording.egress_id) {
        try {
          await egressClient.stopEgress(
            recording.egress_id,
          );
        } catch (error) {
          logError(
            "Stop recording during call close failed",
            error,
            requestId,
          );
        }
      }

      const { error } = await supabase
        .from("lolz_call_recordings")
        .update({
          status: "stopped",
          ended_at: new Date().toISOString(),
        })
        .eq("id", recording.id);

      if (error) {
        logError(
          "Save recording stop failed",
          error,
          requestId,
        );
      }
    }

    // ==================================================
    // CLOSE CALL
    // ==================================================

    async function closeCall(
      call: Record<string, any>,
    ): Promise<void> {
      // Recording cleanup must never prevent the call from ending.
      try {
        await stopRecordingForCall(call);
      } catch (error) {
        logError(
          "Recording cleanup during call close failed",
          error,
          requestId,
        );
      }

      const { data, error } = await supabase
        .from("lolz_calls")
        .update({
          status: "ended",
          ended_at: new Date().toISOString(),
        })
        .eq("id", call.id)
        .eq("status", "active")
        .select("id");

      if (error) {
        logError(
          "Close call database update failed",
          error,
          requestId,
        );
        throw new HttpError("Could not end call");
      }

      if (!data?.length) return;

      try {
        await roomService.deleteRoom(call.room_name);
      } catch (error) {
        logError(
          "LiveKit room cleanup failed",
          error,
          requestId,
        );
      }
    }

    // ==================================================
    // INCOMING PRIVATE CALLS
    // ==================================================

    if (action === "incoming_calls") {
      const { data: conversations, error } = await supabase
        .from("conversations")
        .select("id")
        .or(
          `user_one.eq.${userId},user_two.eq.${userId}`,
        );

      if (error) {
        logError(
          "Load conversations failed",
          error,
          requestId,
        );
        throw new HttpError(
          "Could not load conversations",
        );
      }

      const ids: string[] = (conversations || []).map(
        (item: { id: string }) => item.id,
      );

      if (!ids.length) {
        return response({
          success: true,
          calls: [],
        });
      }

      const { data, error: incomingError } = await supabase
        .from("lolz_calls")
        .select(
          "id, room_name, call_type, media_type, conversation_id, created_by, status, created_at",
        )
        .eq("call_type", "private")
        .eq("status", "active")
        .neq("created_by", userId)
        .in("conversation_id", ids)
        .order("created_at", { ascending: false });

      if (incomingError) {
        logError(
          "Load incoming calls failed",
          incomingError,
          requestId,
        );
        throw new HttpError(
          "Could not load incoming calls",
        );
      }

      return response({
        success: true,
        calls: data || [],
      });
    }

    // ==================================================
    // ACTIVE GROUP AND CHANNEL CALLS
    // ==================================================

    if (action === "active_calls") {
      const [
        { data: groupMemberships, error: groupError },
        { data: channelMemberships, error: channelError },
      ] = await Promise.all([
        supabase
          .from("group_members")
          .select("group_id")
          .eq("user_id", userId),

        supabase
          .from("channel_members")
          .select("channel_id")
          .eq("user_id", userId),
      ]);

      if (groupError) {
        logError(
          "Load group memberships failed",
          groupError,
          requestId,
        );
        throw new HttpError(
          "Could not load group memberships",
        );
      }

      if (channelError) {
        logError(
          "Load channel memberships failed",
          channelError,
          requestId,
        );
        throw new HttpError(
          "Could not load channel memberships",
        );
      }

      const groupIds: string[] = (groupMemberships || [])
        .map((item: { group_id: string }) => item.group_id);

      const channelIds: string[] = (channelMemberships || [])
        .map((item: { channel_id: string }) => item.channel_id);

      const calls: any[] = [];

      if (groupIds.length) {
        const { data, error } = await supabase
          .from("lolz_calls")
          .select(
            "id, room_name, call_type, media_type, group_id, created_by, status, created_at",
          )
          .eq("call_type", "group")
          .eq("status", "active")
          .in("group_id", groupIds);

        if (error) {
          logError(
            "Load active group calls failed",
            error,
            requestId,
          );
          throw new HttpError(
            "Could not load active group calls",
          );
        }

        calls.push(...(data || []));
      }

      if (channelIds.length) {
        const { data, error } = await supabase
          .from("lolz_calls")
          .select(
            "id, room_name, call_type, media_type, channel_id, created_by, status, created_at",
          )
          .eq("call_type", "channel")
          .eq("status", "active")
          .in("channel_id", channelIds);

        if (error) {
          logError(
            "Load active channel calls failed",
            error,
            requestId,
          );
          throw new HttpError(
            "Could not load active channel calls",
          );
        }

        calls.push(...(data || []));
      }

      calls.sort((a, b) =>
        new Date(b.created_at).getTime() -
        new Date(a.created_at).getTime()
      );

      return response({
        success: true,
        calls,
      });
    }

    // ==================================================
    // UPDATE GROUP OR CHANNEL CALL MODE
    // ==================================================

    if (action === "update_call_mode") {
      if (!isOneOf(call_mode, ["open", "moderated"])) {
        throw new HttpError("Invalid call mode", 400);
      }

      const isGroup =
        call_type === "group" && isUuid(group_id);
      const isChannel =
        call_type === "channel" && isUuid(channel_id);

      if (isGroup === isChannel) {
        throw new HttpError(
          "Invalid group or channel",
          400,
        );
      }

      const table = isGroup
        ? "group_members"
        : "channel_members";
      const idColumn = isGroup
        ? "group_id"
        : "channel_id";
      const scopeId = isGroup ? group_id : channel_id;
      const parentTable = isGroup ? "groups" : "channels";

      const { data: membership, error: membershipError } =
        await supabase
          .from(table)
          .select("role")
          .eq(idColumn, scopeId)
          .eq("user_id", userId)
          .maybeSingle();

      if (membershipError) {
        logError(
          "Check call mode permissions failed",
          membershipError,
          requestId,
        );
        throw new HttpError(
          "Could not verify admin permissions",
        );
      }

      if (
        !membership ||
        !["owner", "admin"].includes(membership.role)
      ) {
        throw new HttpError(
          "Only admins can change call mode",
          403,
        );
      }

      const { error } = await supabase
        .from(parentTable)
        .update({ call_mode })
        .eq("id", scopeId);

      if (error) {
        logError(
          "Update call mode failed",
          error,
          requestId,
        );
        throw new HttpError(
          "Could not update call mode",
        );
      }

      return response({
        success: true,
        call_mode,
      });
    }

    // ==================================================
    // CREATE CALL
    // ==================================================

    if (action === "create") {
      if (
        !isOneOf(call_type, [
          "private",
          "group",
          "channel",
        ])
      ) {
        throw new HttpError("Invalid call type", 400);
      }

      const selectedMediaType =
        media_type === "video" ? "video" : "audio";

      const scope: Record<string, string> = {};

      // PRIVATE CALL

      if (call_type === "private") {
        if (
          !isUuid(conversation_id) ||
          group_id ||
          channel_id
        ) {
          throw new HttpError(
            "Invalid private call: conversation_id is required",
            400,
          );
        }

        const { data, error } = await supabase
          .from("conversations")
          .select("id")
          .eq("id", conversation_id)
          .or(
            `user_one.eq.${userId},user_two.eq.${userId}`,
          )
          .maybeSingle();

        if (error) {
          logError(
            "Private conversation lookup failed",
            error,
            requestId,
          );
          throw new HttpError(
            "Could not verify conversation",
          );
        }

        if (!data) {
          throw new HttpError(
            "Not a conversation member",
            403,
          );
        }

        scope.conversation_id = conversation_id;
      }

      // GROUP CALL

      if (call_type === "group") {
        if (
          !isUuid(group_id) ||
          conversation_id ||
          channel_id
        ) {
          throw new HttpError(
            "Invalid group call",
            400,
          );
        }

        const { data, error } = await supabase
          .from("group_members")
          .select("role")
          .eq("group_id", group_id)
          .eq("user_id", userId)
          .maybeSingle();

        if (error) {
          logError(
            "Group membership lookup failed",
            error,
            requestId,
          );
          throw new HttpError(
            "Could not verify group membership",
          );
        }

        if (
          !data ||
          !["owner", "admin"].includes(data.role)
        ) {
          throw new HttpError(
            "Only group admins can start calls",
            403,
          );
        }

        scope.group_id = group_id;
      }

      // CHANNEL CALL

      if (call_type === "channel") {
        if (
          !isUuid(channel_id) ||
          conversation_id ||
          group_id
        ) {
          throw new HttpError(
            "Invalid channel call",
            400,
          );
        }

        const { data, error } = await supabase
          .from("channel_members")
          .select("role")
          .eq("channel_id", channel_id)
          .eq("user_id", userId)
          .maybeSingle();

        if (error) {
          logError(
            "Channel membership lookup failed",
            error,
            requestId,
          );
          throw new HttpError(
            "Could not verify channel membership",
          );
        }

        if (
          !data ||
          !["owner", "admin"].includes(data.role)
        ) {
          throw new HttpError(
            "Only channel admins can start calls",
            403,
          );
        }

        scope.channel_id = channel_id;
      }

      const roomName = `lolz-${crypto.randomUUID()}`;

      const { data: newCall, error: createError } =
        await supabase
          .from("lolz_calls")
          .insert({
            ...scope,
            call_type,
            media_type: selectedMediaType,
            room_name: roomName,
            created_by: userId,
            status: "active",
          })
          .select("*")
          .single();

      if (createError || !newCall) {
        logError(
          "LOLZ call creation failed",
          createError,
          requestId,
        );
        throw new HttpError(
          createError?.message || "Could not create call",
          500,
        );
      }

      const { error: participantError } = await supabase
        .from("lolz_call_participants")
        .upsert(
          {
            call_id: newCall.id,
            user_id: userId,
            can_publish: true,
            can_subscribe: true,
            left_at: null,
          },
          {
            onConflict: "call_id,user_id",
          },
        );

      if (participantError) {
        logError(
          "Register call creator failed",
          participantError,
          requestId,
        );

        try {
          await closeCall(newCall);
        } catch (cleanupError) {
          logError(
            "Failed to clean up incomplete call",
            cleanupError,
            requestId,
          );
        }

        throw new HttpError(
          "Could not register call creator",
        );
      }

      let token: string;

      try {
        token = await createToken(roomName, true);
      } catch (error) {
        logError(
          "Create LiveKit token failed",
          error,
          requestId,
        );

        try {
          await closeCall(newCall);
        } catch (cleanupError) {
          logError(
            "Failed to clean up call after token error",
            cleanupError,
            requestId,
          );
        }

        throw new HttpError(
          "Could not create LiveKit token",
        );
      }

      return response({
        success: true,
        call: newCall,
        token,
        server_url: LIVEKIT_URL,
        can_publish: true,
        media_type: selectedMediaType,
      });
    }

    // ==================================================
    // ALL REMAINING ACTIONS REQUIRE CALL ID
    // ==================================================

    if (!isUuid(call_id)) {
      throw new HttpError(
        "A valid call_id is required",
        400,
      );
    }

    const call = await getCall();

    // ==================================================
    // RECORDING STATUS
    // ==================================================

    if (action === "recording_state") {
      if (
        call.call_type !== "group" &&
        call.call_type !== "channel"
      ) {
        throw new HttpError(
          "Recording is not available in private calls",
          400,
        );
      }

      if (!(await checkMembership(call))) {
        throw new HttpError(
          "You are not a member",
          403,
        );
      }

      const recording = await getActiveRecording(call.id);
      const consents = recording
        ? await getRecordingConsents(call.id)
        : [];

      return response({
        success: true,
        recording,
        consents,
        can_manage_recording: await isAdmin(call),
      });
    }

    // ==================================================
    // REQUEST RECORDING CONSENT
    // ==================================================

    if (action === "recording_request") {
      await requireRecordingManager(call);

      if (call.status !== "active") {
        throw new HttpError("Call has ended", 400);
      }

      const existingRecording = await getActiveRecording(
        call.id,
      );

      if (existingRecording) {
        throw new HttpError(
          "A recording request or recording is already active",
          409,
        );
      }

      const participants = await getActiveParticipants(
        call.id,
      );

      const participantIds =
        getUniqueParticipantIds(participants);

      if (!participantIds.includes(userId)) {
        throw new HttpError(
          "Join the call before requesting recording",
          400,
        );
      }

      const {
        data: recording,
        error: recordingError,
      } = await supabase
        .from("lolz_call_recordings")
        .insert({
          call_id: call.id,
          status: "consent_pending",
          created_by: userId,
          started_at: new Date().toISOString(),
        })
        .select("*")
        .single();

      if (recordingError || !recording) {
        logError(
          "Create recording request failed",
          recordingError,
          requestId,
        );
        throw new HttpError(
          "Could not create recording request",
        );
      }

      const now = new Date().toISOString();

      const consentRows = participantIds.map((id) => ({
        call_id: call.id,
        user_id: id,
        decision: id === userId
          ? "approved"
          : "pending",
        responded_at: id === userId ? now : null,
      }));

      const { error: consentError } = await supabase
        .from("lolz_call_recording_consents")
        .upsert(consentRows, {
          onConflict: "call_id,user_id",
        });

      if (consentError) {
        logError(
          "Create recording consents failed",
          consentError,
          requestId,
        );

        await cancelRecording(recording.id);

        throw new HttpError(
          "Could not create recording consent requests",
        );
      }

      return response({
        success: true,
        recording,
        message: "Recording consent requested",
        consents: await getRecordingConsents(call.id),
      });
    }

    // ==================================================
    // PARTICIPANT ACCEPTS OR REJECTS RECORDING
    // ==================================================

    if (action === "recording_consent") {
      if (
        call.call_type !== "group" &&
        call.call_type !== "channel"
      ) {
        throw new HttpError(
          "Recording is not available in private calls",
          400,
        );
      }

      if (!(await checkMembership(call))) {
        throw new HttpError(
          "You are not a member",
          403,
        );
      }

      if (!isOneOf(decision, ["approved", "rejected"])) {
        throw new HttpError(
          "Invalid recording decision",
          400,
        );
      }

      const recording = await getActiveRecording(call.id);

      if (!recording) {
        throw new HttpError(
          "There is no active recording request",
          404,
        );
      }

      const {
        data: currentParticipant,
        error: participantError,
      } = await supabase
        .from("lolz_call_participants")
        .select("id")
        .eq("call_id", call.id)
        .eq("user_id", userId)
        .is("left_at", null)
        .maybeSingle();

      if (participantError) {
        logError(
          "Check recording participant failed",
          participantError,
          requestId,
        );
        throw new HttpError(
          "Could not verify call participation",
        );
      }

      // Members outside the call may consent before joining.
      const { error: consentError } = await supabase
        .from("lolz_call_recording_consents")
        .upsert({
          call_id: call.id,
          user_id: userId,
          decision,
          responded_at: new Date().toISOString(),
        }, {
          onConflict: "call_id,user_id",
        });

      if (consentError) {
        logError(
          "Save recording consent failed",
          consentError,
          requestId,
        );
        throw new HttpError(
          "Could not save your recording decision",
        );
      }

      let cancelled = false;

      // A current participant rejecting the initial request
      // cancels the pending recording request.
      // A late joiner rejecting an active recording is only
      // prevented from joining; existing recording continues.
      if (
        decision === "rejected" &&
        currentParticipant &&
        recording.status === "consent_pending"
      ) {
        await cancelRecording(recording.id);
        cancelled = true;
      }

      return response({
        success: true,
        decision,
        cancelled,
        requires_retry_to_join: decision === "approved",
        consents: await getRecordingConsents(call.id),
      });
    }

    // ==================================================
    // START RECORDING - OWNER OR ADMIN
    // ==================================================

    if (action === "recording_start") {
      await requireRecordingManager(call);

      if (call.status !== "active") {
        throw new HttpError("Call has ended", 400);
      }

      const recording = await getActiveRecording(call.id);

      if (
        !recording ||
        recording.status !== "consent_pending"
      ) {
        throw new HttpError(
          "There is no pending recording request",
          404,
        );
      }

      // Verify that every current participant has approved.
      const participants = await getActiveParticipants(
        call.id,
      );

      const participantIds =
        getUniqueParticipantIds(participants);

      const consents = await getRecordingConsents(call.id);

      const consentMap = new Map<string, string>(
        consents.map((item: any) => [
          item.user_id as string,
          item.decision as string,
        ]),
      );

      const missingConsents = participantIds.filter(
        (id) => consentMap.get(id) !== "approved",
      );

      if (missingConsents.length > 0) {
        throw new HttpError(
          "Everyone currently in the call must approve recording first",
          409,
        );
      }

      // Claim the request to prevent two admins starting it.
      const { data: claimed, error: claimError } =
        await supabase
          .from("lolz_call_recordings")
          .update({ status: "starting" })
          .eq("id", recording.id)
          .eq("status", "consent_pending")
          .select("id")
          .maybeSingle();

      if (claimError) {
        logError(
          "Claim recording failed",
          claimError,
          requestId,
        );
        throw new HttpError(
          "Could not prepare recording",
        );
      }

      if (!claimed) {
        throw new HttpError(
          "Recording has already been started or cancelled",
          409,
        );
      }

      // Check participants and consent again after claiming.
      const participantsAfterClaim =
        await getActiveParticipants(call.id);

      const participantIdsAfterClaim =
        getUniqueParticipantIds(participantsAfterClaim);

      const consentsAfterClaim =
        await getRecordingConsents(call.id);

      const consentMapAfterClaim = new Map<string, string>(
        consentsAfterClaim.map((item: any) => [
          item.user_id as string,
          item.decision as string,
        ]),
      );

      const missingAfterClaim =
        participantIdsAfterClaim.filter(
          (id) => consentMapAfterClaim.get(id) !== "approved",
        );

      if (missingAfterClaim.length > 0) {
        await supabase
          .from("lolz_call_recordings")
          .update({ status: "consent_pending" })
          .eq("id", recording.id)
          .eq("status", "starting");

        throw new HttpError(
          "A participant has not approved recording. Please collect consent again.",
          409,
        );
      }

      // S3-compatible private storage configuration.
      const accessKey = Deno.env.get(
        "LIVEKIT_S3_ACCESS_KEY",
      );
      const secretKey = Deno.env.get(
        "LIVEKIT_S3_SECRET_KEY",
      );
      const endpoint = Deno.env.get(
        "LIVEKIT_S3_ENDPOINT",
      );
      const region = Deno.env.get(
        "LIVEKIT_S3_REGION",
      ) || "eu-west-1";

      if (!accessKey || !secretKey || !endpoint) {
        await cancelRecording(recording.id);

        throw new HttpError(
          "Recording storage configuration is missing",
        );
      }

      const filePath =
        `calls/${call.id}/${recording.id}.ogg`;

      try {
        const s3Upload = new S3Upload({
          accessKey,
          secret: secretKey,
          bucket: RECORDING_BUCKET,
          region,
          endpoint,
          forcePathStyle: true,
        });

        const fileOutput = new EncodedFileOutput({
          filepath: filePath,
          output: {
            case: "s3",
            value: s3Upload,
          },
        });

        const egressInfo =
          await egressClient.startRoomCompositeEgress(
            call.room_name,
            {
              file: fileOutput,
            },
            {
              audioOnly: true,
            },
          );

        if (!egressInfo.egressId) {
          throw new Error(
            "LiveKit did not return an egress ID",
          );
        }

        const { error: saveError } = await supabase
          .from("lolz_call_recordings")
          .update({
            egress_id: egressInfo.egressId,
            file_path: filePath,
            status: "recording",
          })
          .eq("id", recording.id)
          .eq("status", "starting");

        if (saveError) {
          try {
            await egressClient.stopEgress(
              egressInfo.egressId,
            );
          } catch (stopError) {
            logError(
              "Recording rollback failed",
              stopError,
              requestId,
            );
          }

          throw new Error(
            "Could not save recording information",
          );
        }

        return response({
          success: true,
          recording: {
            id: recording.id,
            egress_id: egressInfo.egressId,
            file_path: filePath,
            status: "recording",
          },
          message: "Audio recording started",
        });
      } catch (error) {
        logError(
          "Start recording failed",
          error,
          requestId,
        );

        await supabase
          .from("lolz_call_recordings")
          .update({
            status: "failed",
            ended_at: new Date().toISOString(),
          })
          .eq("id", recording.id);

        throw new HttpError(
          "Could not start recording. Check LiveKit Egress and Supabase S3 settings.",
        );
      }
    }

    // ==================================================
    // STOP RECORDING - OWNER OR ADMIN
    // ==================================================

    if (action === "recording_stop") {
      await requireRecordingManager(call);

      const recording = await getActiveRecording(call.id);

      if (!recording) {
        throw new HttpError(
          "There is no active recording",
          404,
        );
      }

      if (
        recording.status === "consent_pending" ||
        recording.status === "starting"
      ) {
        await cancelRecording(recording.id);

        return response({
          success: true,
          status: "cancelled",
          recording_id: recording.id,
        });
      }

      if (
        recording.status !== "recording" ||
        !recording.egress_id
      ) {
        throw new HttpError(
          "There is no active recording to stop",
          404,
        );
      }

      try {
        await egressClient.stopEgress(
          recording.egress_id,
        );
      } catch (error) {
        logError(
          "Stop recording failed",
          error,
          requestId,
        );
        throw new HttpError(
          "Could not stop the recording",
        );
      }

      const { error } = await supabase
        .from("lolz_call_recordings")
        .update({
          status: "stopped",
          ended_at: new Date().toISOString(),
        })
        .eq("id", recording.id);

      if (error) {
        logError(
          "Save recording stop failed",
          error,
          requestId,
        );
        throw new HttpError(
          "Could not save recording status",
        );
      }

      return response({
        success: true,
        status: "stopped",
        recording_id: recording.id,
        file_path: recording.file_path,
      });
    }

    // ==================================================
    // REJECT PRIVATE CALL
    // ==================================================

    if (action === "reject") {
      if (call.call_type !== "private") {
        throw new HttpError(
          "Only private calls can be rejected",
          400,
        );
      }

      if (!(await checkMembership(call))) {
        throw new HttpError(
          "Not a conversation member",
          403,
        );
      }

      if (call.created_by === userId) {
        throw new HttpError(
          "The caller cannot reject their own call",
          403,
        );
      }

      if (call.status !== "active") {
        throw new HttpError(
          "Call has already ended",
          400,
        );
      }

      await closeCall(call);

      return response({
        success: true,
        rejected: true,
      });
    }

    // ==================================================
    // CHECK CALL STATUS
    // ==================================================

    if (call.status !== "active") {
      throw new HttpError("Call has ended", 400);
    }

    // ==================================================
    // JOIN CALL
    // ==================================================

    if (action === "join") {
      if (!(await checkMembership(call))) {
        throw new HttpError(
          "You are not a member",
          403,
        );
      }

      // Do not issue a LiveKit token until recording consent
      // has been granted.
      if (
        call.call_type === "group" ||
        call.call_type === "channel"
      ) {
        const recording = await getActiveRecording(
          call.id,
        );

        if (recording) {
          const {
            data: consent,
            error: consentError,
          } = await supabase
            .from("lolz_call_recording_consents")
            .select("decision")
            .eq("call_id", call.id)
            .eq("user_id", userId)
            .maybeSingle();

          if (consentError) {
            logError(
              "Check late join recording consent failed",
              consentError,
              requestId,
            );
            throw new HttpError(
              "Could not check recording consent",
            );
          }

          if (consent?.decision !== "approved") {
            if (consent?.decision !== "rejected") {
              const { error: pendingError } =
                await supabase
                  .from("lolz_call_recording_consents")
                  .upsert({
                    call_id: call.id,
                    user_id: userId,
                    decision: "pending",
                    responded_at: null,
                  }, {
                    onConflict: "call_id,user_id",
                  });

              if (pendingError) {
                logError(
                  "Create late join consent failed",
                  pendingError,
                  requestId,
                );
                throw new HttpError(
                  "Could not request recording consent",
                );
              }
            }

            return response({
              success: false,
              requires_recording_consent: true,
              recording_status: recording.status,
              decision: consent?.decision || "pending",
              error: consent?.decision === "rejected"
                ? "You rejected recording and cannot join while it is active."
                : "Please approve recording before joining this call.",
            }, 403);
          }
        }
      }

      const admin = await isAdmin(call);
      const mode = await getCallMode(call);

      let canPublish = true;

      if (
        call.call_type !== "private" &&
        mode === "moderated"
      ) {
        const {
          data: approvedRequests,
          error,
        } = await supabase
          .from("lolz_call_speak_requests")
          .select("id")
          .eq("call_id", call_id)
          .eq("user_id", userId)
          .eq("status", "approved")
          .limit(1);

        if (error) {
          logError(
            "Load approved speak request failed",
            error,
            requestId,
          );
          throw new HttpError(
            "Could not check speaking permission",
          );
        }

        canPublish = admin || !!approvedRequests?.length;
      }

      const { error: participantError } = await supabase
        .from("lolz_call_participants")
        .upsert(
          {
            call_id,
            user_id: userId,
            can_publish: canPublish,
            can_subscribe: true,
            left_at: null,
          },
          {
            onConflict: "call_id,user_id",
          },
        );

      if (participantError) {
        logError(
          "Join call participant update failed",
          participantError,
          requestId,
        );
        throw new HttpError("Could not join call");
      }

      const token = await createToken(
        call.room_name,
        canPublish,
      );

      return response({
        success: true,
        token,
        server_url: LIVEKIT_URL,
        can_publish: canPublish,
        call_mode: mode,
        is_admin: admin,
        media_type: call.media_type || "audio",
      });
    }

    // ==================================================
    // LIST CALL PARTICIPANTS
    // ==================================================

    if (action === "list_participants") {
      if (!(await checkMembership(call))) {
        throw new HttpError(
          "You are not a member",
          403,
        );
      }

      const participants = await getActiveParticipants(
        call.id,
      );

      const userIds =
        getUniqueParticipantIds(participants);

      let profiles: any[] = [];

      if (userIds.length > 0) {
        const { data, error } = await supabase
          .from("profiles")
          .select(
            "id, username, full_name, display_name, avatar_url",
          )
          .in("id", userIds);

        if (error) {
          logError(
            "Load participant profiles failed",
            error,
            requestId,
          );
          throw new HttpError(
            "Could not load participant profiles",
          );
        }

        profiles = data || [];
      }

      const profileMap = new Map<string, any>(
        profiles.map((profile: any) => [
          profile.id as string,
          profile,
        ]),
      );

      const result = participants.map(
        (participant) => ({
          ...participant,
          profile:
            profileMap.get(participant.user_id) || null,
        }),
      );

      return response({
        success: true,
        participants: result,
      });
    }

    // ==================================================
    // REQUEST TO SPEAK
    // ==================================================

    if (action === "request_speak") {
      if (call.call_type === "private") {
        throw new HttpError(
          "Private calls do not need permission requests",
          400,
        );
      }

      if (!(await checkMembership(call))) {
        throw new HttpError(
          "You are not a member",
          403,
        );
      }

      const mode = await getCallMode(call);

      if (mode !== "moderated") {
        throw new HttpError(
          "Speaking requests are disabled in open mode",
          400,
        );
      }

      if (await isAdmin(call)) {
        throw new HttpError(
          "Admins already have speaking permission",
          400,
        );
      }

      const {
        data: participant,
        error: participantLookupError,
      } = await supabase
        .from("lolz_call_participants")
        .select("id")
        .eq("call_id", call_id)
        .eq("user_id", userId)
        .is("left_at", null)
        .maybeSingle();

      if (participantLookupError) {
        logError(
          "Check call participant failed",
          participantLookupError,
          requestId,
        );
        throw new HttpError(
          "Could not verify call participation",
        );
      }

      if (!participant) {
        throw new HttpError(
          "Join the call before requesting to speak",
          400,
        );
      }

      const {
        data: existingRequest,
        error: existingError,
      } = await supabase
        .from("lolz_call_speak_requests")
        .select("id")
        .eq("call_id", call_id)
        .eq("user_id", userId)
        .eq("status", "pending")
        .maybeSingle();

      if (existingError) {
        logError(
          "Check existing speak request failed",
          existingError,
          requestId,
        );
        throw new HttpError(
          "Could not check existing request",
        );
      }

      if (existingRequest) {
        return response({
          success: true,
          request: existingRequest,
          message: "Your request is already pending",
        });
      }

      const {
        data: newRequest,
        error,
      } = await supabase
        .from("lolz_call_speak_requests")
        .insert({
          call_id,
          user_id: userId,
          status: "pending",
        })
        .select("*")
        .single();

      if (error || !newRequest) {
        logError(
          "Create speak request failed",
          error,
          requestId,
        );
        throw new HttpError(
          "Could not create speaking request",
        );
      }

      return response({
        success: true,
        request: newRequest,
      });
    }

    // ==================================================
    // LIST SPEAKING REQUESTS
    // ==================================================

    if (action === "list_speak_requests") {
      if (!(await isAdmin(call))) {
        throw new HttpError(
          "Only admins can view speaking requests",
          403,
        );
      }

      const { data, error } = await supabase
        .from("lolz_call_speak_requests")
        .select("*")
        .eq("call_id", call_id)
        .eq("status", "pending")
        .order("requested_at", { ascending: true });

      if (error) {
        logError(
          "List speak requests failed",
          error,
          requestId,
        );
        throw new HttpError(
          "Could not load speaking requests",
        );
      }

      return response({
        success: true,
        requests: data || [],
      });
    }

    // ==================================================
    // RESPOND TO SPEAKING REQUEST
    // ==================================================

    if (action === "respond_speak") {
      if (!(await isAdmin(call))) {
        throw new HttpError(
          "Only admins can respond to requests",
          403,
        );
      }

      if (
        !isUuid(speakRequestId) ||
        !isOneOf(decision, ["approved", "rejected"])
      ) {
        throw new HttpError(
          "Invalid request response",
          400,
        );
      }

      const {
        data: speakRequest,
        error: requestLookupError,
      } = await supabase
        .from("lolz_call_speak_requests")
        .select("*")
        .eq("id", speakRequestId)
        .eq("call_id", call_id)
        .eq("status", "pending")
        .maybeSingle();

      if (requestLookupError) {
        logError(
          "Find pending speak request failed",
          requestLookupError,
          requestId,
        );
        throw new HttpError(
          "Could not load speaking request",
        );
      }

      if (!speakRequest) {
        throw new HttpError(
          "Pending request not found",
          404,
        );
      }

      const {
        data: participant,
        error: participantLookupError,
      } = await supabase
        .from("lolz_call_participants")
        .select("id")
        .eq("call_id", call_id)
        .eq("user_id", speakRequest.user_id)
        .is("left_at", null)
        .maybeSingle();

      if (participantLookupError) {
        logError(
          "Find speaking participant failed",
          participantLookupError,
          requestId,
        );
        throw new HttpError(
          "Could not verify participant",
        );
      }

      if (!participant) {
        throw new HttpError(
          "Participant is no longer in the call",
          404,
        );
      }

      const canPublish = decision === "approved";

      try {
        await updateLiveKitPermission(
          call.room_name,
          speakRequest.user_id,
          canPublish,
        );
      } catch (error) {
        logError(
          "LiveKit permission update failed",
          error,
          requestId,
        );
        throw new HttpError(
          "Could not update participant permission",
        );
      }

      const now = new Date().toISOString();

      const { error: requestError } = await supabase
        .from("lolz_call_speak_requests")
        .update({
          status: decision,
          responded_at: now,
          responded_by: userId,
        })
        .eq("id", speakRequestId)
        .eq("status", "pending");

      if (requestError) {
        logError(
          "Save speak request decision failed",
          requestError,
          requestId,
        );
        throw new HttpError(
          "Could not save speaking request decision",
        );
      }

      const { error: participantUpdateError } =
        await supabase
          .from("lolz_call_participants")
          .update({
            can_publish: canPublish,
          })
          .eq("call_id", call_id)
          .eq("user_id", speakRequest.user_id);

      if (participantUpdateError) {
        logError(
          "Save participant permission failed",
          participantUpdateError,
          requestId,
        );
        throw new HttpError(
          "Could not save participant permission",
        );
      }

      return response({
        success: true,
        target_user_id: speakRequest.user_id,
        can_publish: canPublish,
        decision,
      });
    }

    // ==================================================
    // ADMIN SETS PUBLISH PERMISSION
    // ==================================================

    if (action === "set_publish") {
      if (
        typeof can_publish !== "boolean" ||
        !isUuid(target_user_id)
      ) {
        throw new HttpError(
          "Invalid permission request",
          400,
        );
      }

      if (call.call_type === "private") {
        throw new HttpError(
          "Private call permissions are not managed by admins",
          400,
        );
      }

      if (!(await isAdmin(call))) {
        throw new HttpError(
          "Only admins can manage permissions",
          403,
        );
      }

      if (!(await checkMembership(call, target_user_id))) {
        throw new HttpError(
          "Target user is not a member",
          403,
        );
      }

      const {
        data: participant,
        error: participantLookupError,
      } = await supabase
        .from("lolz_call_participants")
        .select("id")
        .eq("call_id", call_id)
        .eq("user_id", target_user_id)
        .is("left_at", null)
        .maybeSingle();

      if (participantLookupError) {
        logError(
          "Check target participant failed",
          participantLookupError,
          requestId,
        );
        throw new HttpError(
          "Could not verify target participant",
        );
      }

      if (!participant) {
        throw new HttpError(
          "Participant is not in the call",
          404,
        );
      }

      try {
        await updateLiveKitPermission(
          call.room_name,
          target_user_id,
          can_publish,
        );
      } catch (error) {
        logError(
          "Set LiveKit publish permission failed",
          error,
          requestId,
        );
        throw new HttpError(
          "Could not update participant permission",
        );
      }

      const { error } = await supabase
        .from("lolz_call_participants")
        .update({
          can_publish,
        })
        .eq("call_id", call_id)
        .eq("user_id", target_user_id);

      if (error) {
        logError(
          "Save publish permission failed",
          error,
          requestId,
        );
        throw new HttpError(
          "Could not save participant permission",
        );
      }

      if (!can_publish) {
        const { error: revokeError } = await supabase
          .from("lolz_call_speak_requests")
          .update({
            status: "cancelled",
            responded_at: new Date().toISOString(),
            responded_by: userId,
          })
          .eq("call_id", call_id)
          .eq("user_id", target_user_id)
          .eq("status", "approved");

        if (revokeError) {
          logError(
            "Cancel approved speak requests failed",
            revokeError,
            requestId,
          );
          throw new HttpError(
            "Could not cancel speaking approval",
          );
        }
      }

      return response({
        success: true,
        target_user_id,
        can_publish,
      });
    }

    // ==================================================
    // LEAVE CALL
    // ==================================================

    if (action === "leave") {
      if (!(await checkMembership(call))) {
        throw new HttpError(
          "Not a member",
          403,
        );
      }

      if (call.call_type === "private") {
        await closeCall(call);

        return response({
          success: true,
          call_ended: true,
        });
      }

      const { error } = await supabase
        .from("lolz_call_participants")
        .update({
          left_at: new Date().toISOString(),
          can_publish: false,
        })
        .eq("call_id", call_id)
        .eq("user_id", userId)
        .is("left_at", null);

      if (error) {
        logError(
          "Leave call failed",
          error,
          requestId,
        );
        throw new HttpError("Could not leave call");
      }

      return response({
        success: true,
      });
    }

    // ==================================================
    // END CALL
    // ==================================================

    if (action === "end") {
      if (!(await checkMembership(call))) {
        throw new HttpError(
          "Not a member",
          403,
        );
      }

      if (
        call.call_type !== "private" &&
        !(await isAdmin(call))
      ) {
        throw new HttpError(
          "Only admins can end this call",
          403,
        );
      }

      await closeCall(call);

      return response({
        success: true,
      });
    }

    // ==================================================
    // UNKNOWN ACTION
    // ==================================================

    throw new HttpError("Unknown action", 400);
  } catch (error) {
    logError(
      "LiveKit function error",
      error,
      requestId,
    );

    const status = error instanceof HttpError
      ? error.status
      : 500;

    return response({
      success: false,
      error: error instanceof Error
        ? error.message
        : "Internal server error",
      request_id: requestId,
    }, status);
  }
});