import { useEffect, useState } from "react";
import { Bookmark, CornerUpLeft, Pencil, Check, X } from "lucide-react";
import { supabase } from "./supabase";

const REACTIONS = ["❤️", "😂", "😮", "😢", "👍", "🔥"];

export default function MessageActions({ message, conversationId, user, isArabic, onReply, onUpdated }) {
  const [reactions, setReactions] = useState([]);
  const [pinned, setPinned] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content || "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
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
  }, [message.id, conversationId, user.id]);

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
    }
    setBusy(false);
  }

  async function togglePin() {
    setBusy(true);
    const query = supabase.from("lolz_message_pins");
    const result = pinned
      ? await query.delete().eq("conversation_id", String(conversationId)).eq("message_id", String(message.id)).eq("user_id", user.id)
      : await query.insert({ conversation_id: String(conversationId), message_id: String(message.id), user_id: user.id });
    if (!result.error) setPinned(!pinned);
    setBusy(false);
  }

  async function saveEdit() {
    const content = draft.trim();
    if (!content || content === message.content) { setEditing(false); return; }
    setBusy(true);
    const edited_at = new Date().toISOString();
    const { error } = await supabase.from("messages").update({ content, edited_at }).eq("id", message.id).eq("sender_id", user.id);
    if (!error) { onUpdated?.(message.id, { content, edited_at }); setEditing(false); }
    setBusy(false);
  }

  const ar = isArabic === true;
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
    </div>
    {message.edited_at && <small className="lolz-message-edited">{ar ? "تم التعديل" : "edited"}</small>}
  </div>;
}
