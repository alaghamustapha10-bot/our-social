import { useCallback, useEffect, useState } from "react";
import { FileText, Plus, Save, Trash2, Cloud, CloudOff, RefreshCw } from "lucide-react";
import { supabase } from "./supabase";
import "./DraftsCenter.css";

function makeId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = Math.random() * 16 | 0;
    return (char === "x" ? random : (random & 0x3 | 0x8)).toString(16);
  });
}

export default function DraftsCenter({ user, isArabic = false }) {
  const key = `lolz-pending-drafts:${user?.id || "guest"}`;
  const [drafts, setDrafts] = useState([]);
  const [draftType, setDraftType] = useState("post");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [audience, setAudience] = useState("everyone");
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);

  const t = useCallback((ar, en) => isArabic ? ar : en, [isArabic]);

  const readPending = useCallback(() => {
    try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; }
  }, [key]);

  const writePending = useCallback((items) => {
    localStorage.setItem(key, JSON.stringify(items));
  }, [key]);

  const loadDrafts = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const pending = readPending();
    let cloud = [];
    if (navigator.onLine) {
      const { data, error } = await supabase.from("lolz_drafts").select("*").eq("user_id", user.id).order("updated_at", { ascending: false });
      if (error) setNotice(t("تعذر تحميل المسودات السحابية؛ نعرض النسخ المحلية.", "Cloud drafts could not load; showing local copies."));
      else cloud = data || [];
    }
    const localIds = new Set(pending.map((item) => item.id));
    setDrafts([...pending.map((item) => ({ ...item, is_local: true })), ...cloud.filter((item) => !localIds.has(item.id))].sort((a,b) => new Date(b.updated_at) - new Date(a.updated_at)));
    setLoading(false);
  }, [user?.id, readPending, t]);

  const syncPending = useCallback(async () => {
    if (!user?.id || !navigator.onLine) return;
    const pending = readPending();
    if (!pending.length) return;
    const remaining = [];
    for (const draft of pending) {
      const payload = {
        id: draft.id,
        user_id: user.id,
        draft_type: draft.draft_type,
        title: draft.title || "",
        content: draft.content || "",
        audience: draft.audience || "everyone",
        updated_at: draft.updated_at || new Date().toISOString(),
      };
      const { error } = await supabase.from("lolz_drafts").upsert(payload, { onConflict: "id" });
      if (error) remaining.push(draft);
    }
    writePending(remaining);
    await loadDrafts();
  }, [user?.id, readPending, writePending, loadDrafts]);

  useEffect(() => {
    void loadDrafts();
    const onlineHandler = () => { setOnline(true); void syncPending(); };
    const offlineHandler = () => setOnline(false);
    window.addEventListener("online", onlineHandler);
    window.addEventListener("offline", offlineHandler);
    return () => {
      window.removeEventListener("online", onlineHandler);
      window.removeEventListener("offline", offlineHandler);
    };
  }, [loadDrafts, syncPending]);

  async function saveDraft(event) {
    event.preventDefault();
    if (!user?.id || (!content.trim() && !title.trim())) {
      setNotice(t("اكتب عنواناً أو محتوى قبل الحفظ.", "Enter a title or some content before saving."));
      return;
    }
    setSaving(true);
    setNotice("");
    const id = editingId || makeId();
    const payload = {
      id,
      user_id: user.id,
      draft_type: draftType,
      title: title.trim(),
      content: content.trim(),
      audience,
      updated_at: new Date().toISOString(),
    };

    if (navigator.onLine) {
      const { error } = await supabase.from("lolz_drafts").upsert(payload, { onConflict: "id" });
      if (!error) {
        setNotice(t("تم حفظ المسودة في حسابك.", "Draft saved to your account."));
        setTitle(""); setContent(""); setEditingId(null);
        await loadDrafts();
        setSaving(false);
        return;
      }
      setNotice(t("تعذر الحفظ السحابي؛ تم الاحتفاظ بنسخة محلية.", "Cloud save failed; a local copy was kept."));
    } else {
      setNotice(t("أنت غير متصل. حُفظت المسودة على هذا الجهاز.", "You are offline. The draft was saved on this device."));
    }

    const pending = readPending().filter((item) => item.id !== id);
    writePending([payload, ...pending]);
    setDrafts((items) => [{ ...payload, is_local: true }, ...items.filter((item) => item.id !== id)]);
    setTitle(""); setContent(""); setEditingId(null);
    setSaving(false);
  }

  async function removeDraft(draft) {
    const pending = readPending().filter((item) => item.id !== draft.id);
    writePending(pending);
    if (!draft.is_local && navigator.onLine) {
      const { error } = await supabase.from("lolz_drafts").delete().eq("id", draft.id).eq("user_id", user.id);
      if (error) { setNotice(error.message); return; }
    }
    setDrafts((items) => items.filter((item) => item.id !== draft.id));
    if (editingId === draft.id) { setEditingId(null); setTitle(""); setContent(""); }
  }

  function editDraft(draft) {
    setEditingId(draft.id);
    setDraftType(draft.draft_type || "post");
    setTitle(draft.title || "");
    setContent(draft.content || "");
    setAudience(draft.audience || "everyone");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <section className="lolz-drafts-page" dir={isArabic ? "rtl" : "ltr"}>
      <header className="lolz-drafts-header">
        <div><span className="eyebrow">LOLZ · DRAFTS</span><h1>{t("المسودات", "Drafts")}</h1><p>{t("احتفظ بأفكارك واكملها لاحقاً. النصوص تُزامن إلى حسابك وتُحفظ محلياً عند انقطاع الإنترنت.", "Keep ideas and finish them later. Text drafts sync to your account and are stored locally when offline.")}</p></div>
        <span className={`lolz-drafts-connectivity ${online ? "online" : "offline"}`}>{online ? <Cloud size={16}/> : <CloudOff size={16}/>} {online ? t("متصل", "Online") : t("دون اتصال", "Offline")}</span>
      </header>
      <form className="lolz-draft-editor" onSubmit={saveDraft}>
        <div className="lolz-draft-editor-heading"><FileText size={19}/><strong>{editingId ? t("تعديل المسودة", "Edit draft") : t("مسودة جديدة", "New draft")}</strong></div>
        <div className="lolz-draft-fields">
          <select value={draftType} onChange={(event) => setDraftType(event.target.value)} aria-label={t("نوع المسودة", "Draft type")}>
            <option value="post">{t("منشور", "Post")}</option><option value="story">{t("قصة", "Story")}</option><option value="video">{t("فيديو LOLZ", "LOLZ video")}</option>
          </select>
          <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} placeholder={t("عنوان المسودة (اختياري)", "Draft title (optional)")}/>
        </div>
        <textarea value={content} onChange={(event) => setContent(event.target.value)} rows={5} maxLength={10000} placeholder={t("اكتب فكرتك هنا…", "Write your idea here…")}/>
        {draftType === "story" && <label className="lolz-draft-audience">{t("جمهور القصة", "Story audience")}<select value={audience} onChange={(event) => setAudience(event.target.value)}><option value="everyone">{t("الجميع", "Everyone")}</option><option value="close_friends">{t("الأصدقاء المقرّبون", "Close friends")}</option></select></label>}
        <div className="lolz-draft-editor-actions">
          {editingId && <button type="button" className="secondary-button" onClick={() => {setEditingId(null);setTitle("");setContent("");}}>{t("إلغاء التعديل", "Cancel edit")}</button>}
          <button type="submit" className="primary-button" disabled={saving}><Save size={16}/>{saving ? t("جارٍ الحفظ…", "Saving…") : t("حفظ المسودة", "Save draft")}</button>
        </div>
      </form>
      {notice && <p className="lolz-drafts-notice" role="status">{notice}</p>}
      <div className="lolz-drafts-list-heading"><h2>{t("مسوداتك", "Your drafts")}</h2><button type="button" onClick={() => void syncPending()} disabled={!online}><RefreshCw size={15}/>{t("مزامنة", "Sync")}</button></div>
      {loading ? <div className="lolz-drafts-empty">{t("جارٍ التحميل…", "Loading…")}</div> : drafts.length === 0 ? <div className="lolz-drafts-empty">{t("لا توجد مسودات بعد.", "No drafts yet.")}</div> : drafts.map((draft) => <article className="lolz-draft-card" key={draft.id}>
        <button type="button" className="lolz-draft-main" onClick={() => editDraft(draft)}>
          <span className="lolz-draft-type">{draft.draft_type === "story" ? t("قصة", "Story") : draft.draft_type === "video" ? t("فيديو", "Video") : t("منشور", "Post")}{draft.is_local ? ` · ${t("محلي", "Local")}` : ""}</span>
          <strong>{draft.title || t("بدون عنوان", "Untitled")}</strong><span>{draft.content || t("لا يوجد نص", "No text")}</span><small>{new Date(draft.updated_at).toLocaleString(isArabic ? "ar" : "en")}</small>
        </button>
        <button type="button" className="lolz-draft-delete" onClick={() => void removeDraft(draft)} aria-label={t("حذف المسودة", "Delete draft")}><Trash2 size={17}/></button>
      </article>)}
    </section>
  );
}
