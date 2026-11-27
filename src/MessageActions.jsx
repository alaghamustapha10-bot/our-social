import { useEffect, useState } from "react";
import { Bookmark, CornerUpLeft, Pencil, Check, X, Trash2 } from "lucide-react";
import { supabase } from "./supabase";

const REACTIONS = ["❤️", "😂", "😮", "😢", "👍", "🔥"];

export default function MessageActions({ message, conversationId, user, isArabic, onReply, onUpdated }) {
  const [reactions, setReactions] = useState([]);
  const [pinned, setPinned] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content || "");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      if (message.is_deleted) return;
      const [{ data: rows }, { data: pin }] = await Promise.all([
        supabase.from("lolz_message_reactions").select("user_id,reaction").eq("message_id", String(message.id)),
        supabase.from("lolz_message_pins").select("message_id").eq("conversation_id", String(conversationId)).eq("message_id", String(message.id)).eq("user_id", user.id).maybeSingle(),
      ]);
      if (!active) return;
      setReactions(rows || []);
      setPinned(Boolean(pin));
    }
    void load();
    return () => { active = false; };
  }, [message.id, conversationId, user.id, message.is_deleted]);

  async function react(reaction) {
    setBusy(true);
    const mine = reactions.find((item) => item.user_id === user.id);
    let error;
    if (mine?.reaction === reaction) {
      ({ error } = await supabase.from("lolz_message_reactions").delete().eq("message_id", String(message.id)).eq("user_id", user.id));
    } else {
      ({ error } = await supabase.from("lolz_message_reactions").upsert({
        message_id: String(message.id), conversation_id: String(conversationId), user_id: user.id, reaction,
      }, { onConflict: "message_id,user_id" }));
    }
    if (!error) {
      const { data } = await supabase.from("lolz_message_reactions").select("user_id,reaction").eq("message_id", String(message.id));
      setReactions(data || []);
    } else setActionError(error.message);
    setBusy(false);
  }

  async function togglePin() {
    setBusy(true);
    const query = supabase.from("lolz_message_pins");
    const result = pinned
      ? await query.delete().eq("conversation_id", String(conversationId)).eq("message_id", String(message.id)).eq("user_id", user.id)
      : await query.insert({ conversation_id: String(conversationId), message_id: String(message.id), user_id: user.id });
    if (!result.error) setPinned(!pinned);
    else setActionError(result.error.message);
    setBusy(false);
  }

  async function saveEdit() {
    const content = draft.trim();
    if (!content || content === message.content) { setEditing(false); return; }
    setBusy(true);
    setActionError("");
    const edited_at = new Date().toISOString();
    const { error } = await supabase.from("messages").update({ content, edited_at }).eq("id", message.id).eq("sender_id", user.id).eq("is_deleted", false);
    if (!error) { onUpdated?.(message.id, { content, edited_at }); setEditing(false); }
    else setActionError(error.message);
    setBusy(false);
  }

  async function deleteForEveryone() {
    const ar = isArabic === true;
    const confirmed = window.confirm(ar
      ? "حذف هذه الرسالة لدى الجميع؟ لا يمكن التراجع عن ذلك."
      : "Delete this message for everyone? This cannot be undone.");
    if (!confirmed) return;

    setBusy(true);
    setActionError("");
    const deleted_at = new Date().toISOString();
    const { data, error } = await supabase
      .from("messages")
      .update({
        content: "",
        media_url: null,
        file_name: null,
        mime_type: null,
        is_deleted: true,
        deleted_at,
      })
      .eq("id", message.id)
      .eq("sender_id", user.id)
      .eq("is_deleted", false)
      .select("id")
      .maybeSingle();

    if (error || !data) {
      setActionError(error?.message || (ar ? "تعذر حذف الرسالة." : "Could not delete the message."));
      setBusy(false);
      return;
    }

    if (message.media_storage_path && !/^https?:\/\//i.test(message.media_storage_path)) {
      const { error: storageError } = await supabase.storage
        .from("private-messages")
        .remove([message.media_storage_path]);
      if (storageError) console.warn("Could not remove deleted private media:", storageError.message);
    }

    onUpdated?.(message.id, {
      content: "",
      media_url: null,
      file_name: null,
      mime_type: null,
      is_deleted: true,
      deleted_at,
      media_storage_path: null,
      edited_at: null,
    });
    setBusy(false);
  }

  const ar = isArabic === true;
  if (message.is_deleted) return null;

  return <div className="lolz-message-actions">
    {editing ? <div className="lolz-message-edit">
      <input value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={4000} />
      <button type="button" disabled={busy} onClick={() => void saveEdit()} aria-label={ar ? "حفظ" : "Save"}><Check size={14} /></button>
      <button type="button" onClick={() => { setEditing(false); setDraft(message.content || ""); }} aria-label={ar ? "إلغاء" : "Cancel"}><X size={14} /></button>
    </div> : null}
    <div className="lolz-message-action-row">
      {REACTIONS.map((reaction) => <button key={reaction} type="button" disabled={busy} className={reactions.some((item) => item.user_id === user.id && item.reaction === reaction) ? "active" : ""} onClick={() => void react(reaction)} aria-label={reaction}>
        {reaction}{reactions.filter((item) => item.reaction === reaction).length > 1 ? <small>{reactions.filter((item) => item.reaction === reaction).length}</small> : null}
      </button>)}
      <button type="button" disabled={busy} onClick={() => onReply?.(message)} title={ar ? "رد" : "Reply"}><CornerUpLeft size={14} /></button>
      <button type="button" disabled={busy} onClick={() => void togglePin()} className={pinned ? "active" : ""} title={ar ? "حفظ الرسالة" : "Save message"}><Bookmark size={14} /></button>
      {message.sender_id === user.id && message.message_type === "text" && !editing && <button type="button" disabled={busy} onClick={() => { setDraft(message.content || ""); setEditing(true); }} title={ar ? "تعديل" : "Edit"}><Pencil size={14} /></button>}
      {message.sender_id === user.id && <button type="button" disabled={busy} className="lolz-message-delete" onClick={() => void deleteForEveryone()} title={ar ? "حذف لدى الجميع" : "Delete for everyone"} aria-label={ar ? "حذف لدى الجميع" : "Delete for everyone"}><Trash2 size={14} /></button>}
    </div>
    {actionError && <small className="lolz-message-action-error">{actionError}</small>}
    {message.edited_at && <small className="lolz-message-edited">{ar ? "تم التعديل" : "edited"}</small>}
  </div>;
}
