import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

class HttpError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function reply(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function env(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new HttpError("Missing server setting: " + name, 500);
  return value;
}

async function identify(req: Request, db: any) {
  const token = (req.headers.get("Authorization") || "").match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw new HttpError("Authentication required", 401);
  const { data, error } = await db.auth.getUser(token);
  if (error || !data?.user) throw new HttpError("Invalid session", 401);
  const role = String(data.user.app_metadata?.role || "");
  if (!["admin", "owner"].includes(role)) {
    throw new HttpError("Administrator access required", 403);
  }
  return { user: data.user, role };
}

async function target(db: any, id: string, actor: string, role: string) {
  if (!id) throw new HttpError("Target user ID required", 400);
  const { data, error } = await db.auth.admin.getUserById(id);
  if (error || !data?.user) throw new HttpError("Account not found", 404);
  const targetRole = String(data.user.app_metadata?.role || "");
  if (id !== actor && ["admin", "owner"].includes(targetRole) && role !== "owner") {
    throw new HttpError("Only owner can manage another administrator", 403);
  }
  return data.user;
}

async function count(db: any, table: string, pending = false) {
  let query = db.from(table).select("*", { count: "exact", head: true });
  if (pending) query = query.eq("status", "pending");
  const { count: value, error } = await query;
  return error ? null : Number(value || 0);
}

const REPORT_RESOURCES: Record<string, {
  table: string;
  ownerColumn: string;
  mediaColumn?: string;
  bucket?: string;
}> = {
  post: { table: "posts", ownerColumn: "user_id", mediaColumn: "image_url", bucket: "social-media" },
  video: { table: "lolz_videos", ownerColumn: "user_id", mediaColumn: "video_url", bucket: "social-media" },
  comment: { table: "comments", ownerColumn: "user_id" },
  lolz_comment: { table: "lolz_comments", ownerColumn: "user_id" },
  story: { table: "stories", ownerColumn: "user_id", mediaColumn: "media_url", bucket: "social-media" },
  message: { table: "messages", ownerColumn: "sender_id", mediaColumn: "media_url", bucket: "private-messages" },
  group_message: { table: "group_messages", ownerColumn: "sender_id", mediaColumn: "media_url", bucket: "social-media" },
  channel_post: { table: "channel_posts", ownerColumn: "sender_id", mediaColumn: "media_url", bucket: "social-media" },
};

function storageObjectFromUrl(value: unknown, fallbackBucket: string) {
  if (typeof value !== "string" || !value.trim()) return null;
  const raw = value.trim();
  if (!raw.includes("/storage/v1/object/")) {
    return { bucket: fallbackBucket, path: raw.replace(/^\/+/, "") };
  }
  try {
    const url = new URL(raw);
    const marker = "/storage/v1/object/";
    const start = url.pathname.indexOf(marker);
    if (start < 0) return null;
    const tail = decodeURIComponent(url.pathname.slice(start + marker.length));
    const segments = tail.split("/").filter(Boolean);
    if (segments.length < 2) return null;
    const mode = segments[0];
    const bucket = mode === "public" || mode === "sign" || mode === "authenticated"
      ? segments[1]
      : fallbackBucket;
    const path = mode === "public" || mode === "sign" || mode === "authenticated"
      ? segments.slice(2).join("/")
      : segments.slice(1).join("/");
    return path ? { bucket, path } : null;
  } catch {
    return null;
  }
}

async function getReportTargetUser(db: any, report: any) {
  if (report.target_user_id) return String(report.target_user_id);
  if (report.target_type === "user") return String(report.target_id);
  const resource = REPORT_RESOURCES[report.target_type];
  if (!resource) return null;
  const { data, error } = await db
    .from(resource.table)
    .select(resource.ownerColumn)
    .eq("id", report.target_id)
    .maybeSingle();
  if (error) throw new HttpError("Could not identify the reported account: " + error.message, 500);
  return data?.[resource.ownerColumn] ? String(data[resource.ownerColumn]) : null;
}

async function writeModerationAction(db: any, values: Record<string, unknown>) {
  const { error } = await db.from("lolz_moderation_actions").insert(values);
  if (error) throw new HttpError("Could not save the moderation audit entry: " + error.message, 500);
}

async function notifyModerationTarget(db: any, recipientId: string, actorId: string, type: string, data: Record<string, unknown>) {
  if (!recipientId || recipientId === actorId) return;
  const { error } = await db.from("notifications").insert({
    recipient_id: recipientId,
    actor_id: actorId,
    type,
    data,
  });
  if (error) console.warn("Could not send moderation notification:", error.message);
}

async function moderateReport(db: any, user: any, role: string, body: any) {
  const reportId = String(body.report_id || "");
  const decision = String(body.decision || "");
  const allowed = ["reviewing", "resolve", "reject", "warning", "remove_content", "suspend"];
  if (!reportId || !allowed.includes(decision)) {
    throw new HttpError("A valid report and moderation decision are required.");
  }

  const { data: report, error: reportError } = await db
    .from("content_reports")
    .select("*")
    .eq("id", reportId)
    .maybeSingle();
  if (reportError || !report) throw new HttpError("Report not found.", 404);

  if (decision === "reviewing") {
    const { error } = await db.from("content_reports").update({
      status: "reviewing",
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
    }).eq("id", reportId);
    if (error) throw new HttpError("Could not update report: " + error.message, 500);
    return { success: true, status: "reviewing" };
  }

  const now = new Date().toISOString();
  const reason = String(body.reason || report.details || report.reason || "Violation of LOLZ community guidelines").slice(0, 1000);
  const targetUserId = await getReportTargetUser(db, report);
  let targetAccount: any = null;

  if (["warning", "suspend"].includes(decision)) {
    if (!targetUserId) throw new HttpError("The reported account could not be identified.");
    if (targetUserId === user.id) throw new HttpError("You cannot moderate your own account.");
    targetAccount = await target(db, targetUserId, user.id, role);
    const targetRole = String(targetAccount.app_metadata?.role || "");
    if (["admin", "owner"].includes(targetRole)) {
      throw new HttpError("Protected administrator accounts cannot be moderated from a user report.", 403);
    }
  }

  if (decision === "warning") {
    if (!targetUserId) throw new HttpError("The reported account could not be identified.");
    await writeModerationAction(db, {
      target_user_id: targetUserId,
      actor_user_id: user.id,
      action_type: "warning",
      target_type: report.target_type,
      target_id: report.target_id,
      reason,
    });
    await notifyModerationTarget(db, targetUserId, user.id, "moderation_warning", {
      report_id: report.id,
      message: "A moderator has issued a community-guidelines warning for your account.",
    });
  }

  if (decision === "suspend") {
    if (!targetUserId) throw new HttpError("The reported account could not be identified.");
    const hours = Number(body.duration_hours || 24);
    if (![24, 168].includes(hours)) throw new HttpError("Suspension must be 24 hours or 7 days.");
    const until = new Date(Date.now() + hours * 60 * 60 * 1000);
    const { error } = await db.auth.admin.updateUserById(targetUserId, {
      ban_duration: `${hours}h`,
    });
    if (error) throw new HttpError("Account suspension failed: " + error.message, 500);
    await writeModerationAction(db, {
      target_user_id: targetUserId,
      actor_user_id: user.id,
      action_type: "temporary_suspension",
      target_type: report.target_type,
      target_id: report.target_id,
      reason,
      suspension_until: until.toISOString(),
    });
    await notifyModerationTarget(db, targetUserId, user.id, "moderation_suspension", {
      report_id: report.id,
      suspension_until: until.toISOString(),
      message: `Your LOLZ account has been suspended for ${hours} hours after a community-guidelines review.`,
    });
  }

  if (decision === "remove_content") {
    const resource = REPORT_RESOURCES[report.target_type];
    if (!resource) throw new HttpError("This report type does not point to removable content.");
    const { data: row, error: rowError } = await db
      .from(resource.table)
      .select("*")
      .eq("id", report.target_id)
      .maybeSingle();
    if (rowError || !row) throw new HttpError("The reported content could not be found.", 404);
    const { error: deleteError } = await db.from(resource.table).delete().eq("id", report.target_id);
    if (deleteError) throw new HttpError("Content removal failed: " + deleteError.message, 500);
    if (resource.mediaColumn && row[resource.mediaColumn]) {
      const storageObject = storageObjectFromUrl(row[resource.mediaColumn], resource.bucket || "social-media");
      if (storageObject) {
        const { error: storageError } = await db.storage.from(storageObject.bucket).remove([storageObject.path]);
        if (storageError) console.warn("Content removed but media cleanup failed:", storageError.message);
      }
    }
    await writeModerationAction(db, {
      target_user_id: targetUserId,
      actor_user_id: user.id,
      action_type: "content_removed",
      target_type: report.target_type,
      target_id: report.target_id,
      reason,
    });
  }

  if (decision === "resolve" || decision === "reject") {
    await writeModerationAction(db, {
      target_user_id: targetUserId,
      actor_user_id: user.id,
      action_type: decision === "resolve" ? "report_resolved" : "report_rejected",
      target_type: report.target_type,
      target_id: report.target_id,
      reason,
    });
  }

  const finalStatus = decision === "reject" ? "rejected" : "resolved";
  const { error: updateError } = await db.from("content_reports").update({
    status: finalStatus,
    reviewed_at: now,
    reviewed_by: user.id,
  }).eq("id", reportId);
  if (updateError) throw new HttpError("Could not finalize report: " + updateError.message, 500);

  return { success: true, status: finalStatus, decision, target_user_id: targetUserId };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);

  try {
    const db = createClient(
      env("SUPABASE_URL"),
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || env("SERVICE_ROLE_KEY"),
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    const { user, role } = await identify(req, db);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");

    if (action === "overview") {
      const [users, posts, videos, reports] = await Promise.all([
        count(db, "profiles"),
        count(db, "posts"),
        count(db, "lolz_videos"),
        count(db, "content_reports", true),
      ]);
      return reply({ stats: { users, posts, videos, pending_reports: reports } });
    }

    if (action === "search_users") {
      const query = String(body.query || "").trim().replace(/[,%()]/g, " ").slice(0, 50);
      if (query.length < 2) throw new HttpError("Enter at least 2 characters");
      const term = "%" + query + "%";
      const { data: profiles, error } = await db.from("profiles")
        .select("id,username,display_name,avatar_url,is_verified")
        .or("username.ilike." + term + ",display_name.ilike." + term)
        .order("username")
        .limit(30);
      if (error) throw new HttpError("Profile search failed: " + error.message, 500);
      const ids = (profiles || []).map((p: any) => p.id);
      if (!ids.length) return reply({ users: [] });
      const { data: grants, error: grantError } = await db.from("lolz_admin_premium_grants")
        .select("user_id")
        .in("user_id", ids)
        .is("revoked_at", null);
      if (grantError) throw new HttpError("Premium lookup failed: " + grantError.message, 500);
      const granted = new Set((grants || []).map((g: any) => g.user_id));
      const users = await Promise.all((profiles || []).map(async (p: any) => {
        const { data } = await db.auth.admin.getUserById(p.id);
        const account = data?.user;
        const until = account?.banned_until;
        return {
          ...p,
          role: String(account?.app_metadata?.role || ""),
          is_premium: granted.has(p.id),
          is_banned: Boolean(until && new Date(until).getTime() > Date.now()),
        };
      }));
      return reply({ users });
    }

    if (action === "set_verified") {
      const id = String(body.target_user_id || "");
      const enabled = body.enabled === true;
      await target(db, id, user.id, role);
      const { error } = await db.from("profiles")
        .update({
          is_verified: enabled,
          verified_at: enabled ? new Date().toISOString() : null,
          verified_by: enabled ? user.id : null,
        })
        .eq("id", id);
      if (error) throw new HttpError("Verification update failed: " + error.message, 500);
      return reply({ success: true, is_verified: enabled });
    }

    if (action === "set_premium") {
      const id = String(body.target_user_id || "");
      const enabled = body.enabled === true;
      const account = await target(db, id, user.id, role);
      if (["admin", "owner"].includes(String(account.app_metadata?.role || ""))) {
        throw new HttpError("Admins already have Premium access");
      }
      if (enabled) {
        const { error } = await db.from("lolz_admin_premium_grants").upsert({
          user_id: id,
          granted_by: user.id,
          granted_at: new Date().toISOString(),
          revoked_at: null,
        }, { onConflict: "user_id" });
        if (error) throw new HttpError(error.message, 500);
      } else {
        const { error } = await db.from("lolz_admin_premium_grants")
          .update({ revoked_at: new Date().toISOString() })
          .eq("user_id", id)
          .is("revoked_at", null);
        if (error) throw new HttpError(error.message, 500);
      }
      return reply({ success: true, is_premium: enabled });
    }

    if (action === "set_ban") {
      const id = String(body.target_user_id || "");
      const enabled = body.enabled === true;
      if (id === user.id) throw new HttpError("Cannot suspend your own account");
      const account = await target(db, id, user.id, role);
      if (["admin", "owner"].includes(String(account.app_metadata?.role || ""))) {
        throw new HttpError("Admin accounts cannot be suspended", 403);
      }
      const { error } = await db.auth.admin.updateUserById(id, {
        ban_duration: enabled ? "876000h" : "none",
      });
      if (error) throw new HttpError(error.message, 500);
      return reply({ success: true, is_banned: enabled });
    }

    if (action === "moderate_report") {
      const result = await moderateReport(db, user, role, body);
      return reply(result);
    }

    throw new HttpError("Unsupported admin action");
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    if (!(error instanceof HttpError)) console.error("lolz-admin failed", error);
    return reply({
      error: error instanceof Error ? error.message : "Unexpected server error",
    }, status);
  }
});
