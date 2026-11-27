import { useEffect, useState } from "react";
import { Plus, Play, Trash2, X, Sparkles, LoaderCircle } from "lucide-react";
import { supabase } from "./supabase";
import StoryViewer from "./StoryViewer";

export default function StoryHighlights({
  ownerId,
  currentUserId,
  ownerProfile = {},
  availableStories = [],
  isArabic = false,
}) {
  const isOwner = ownerId === currentUserId;
  const [highlights, setHighlights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [viewing, setViewing] = useState(null);
  const [notice, setNotice] = useState("");

  const copy = isArabic ? {
    title: isOwner ? "أبرز القصص" : "القصص المميزة",
    add: "جديد",
    create: "إنشاء مجموعة",
    name: "اسم المجموعة",
    choose: "اختر القصص النشطة لإضافتها",
    save: "حفظ",
    cancel: "إلغاء",
    empty: "لم تتم إضافة قصص مميزة بعد.",
    none: "لا توجد قصص نشطة لإضافتها الآن.",
    failed: "تعذر تحميل أبرز القصص: ",
    saved: "تم إنشاء المجموعة.",
    saveFailed: "تعذر إنشاء المجموعة: ",
    remove: "حذف المجموعة",
    deleteConfirm: "هل تريد حذف مجموعة القصص هذه؟",
    limit: "اختر قصة واحدة على الأقل، واكتب اسماً قصيراً.",
  } : {
    title: isOwner ? "Story highlights" : "Highlights",
    add: "New",
    create: "Create a highlight",
    name: "Highlight title",
    choose: "Choose active stories to add",
    save: "Save",
    cancel: "Cancel",
    empty: "No story highlights yet.",
    none: "There are no active stories to add right now.",
    failed: "Could not load highlights: ",
    saved: "Highlight created.",
    saveFailed: "Could not create highlight: ",
    remove: "Delete highlight",
    deleteConfirm: "Delete this story highlight?",
    limit: "Choose at least one story and enter a short title.",
  };

  async function load() {
    if (!ownerId) return;
    setLoading(true);
    const { data: headers, error: headerError } = await supabase
      .from("lolz_story_highlights")
      .select("id,owner_id,title,cover_url,created_at")
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false });
    if (headerError) {
      setNotice(copy.failed + headerError.message);
      setHighlights([]);
      setLoading(false);
      return;
    }
    const ids = (headers || []).map((item) => item.id);
    let items = [];
    if (ids.length) {
      const { data, error } = await supabase
        .from("lolz_story_highlight_items")
        .select("*")
        .in("highlight_id", ids)
        .order("position", { ascending: true });
      if (error) {
        setNotice(copy.failed + error.message);
        setLoading(false);
        return;
      }
      items = data || [];
    }
    setHighlights((headers || []).map((header) => ({
      ...header,
      items: items.filter((item) => item.highlight_id === header.id),
    })).filter((header) => header.items.length));
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, [ownerId]);

  function toggleStory(id) {
    setSelectedIds((current) => current.includes(String(id))
      ? current.filter((value) => value !== String(id))
      : [...current, String(id)]);
  }

  async function createHighlight() {
    const cleanTitle = title.trim().slice(0, 30);
    const chosen = availableStories.filter((story) => selectedIds.includes(String(story.id)) && story.user_id === ownerId);
    if (!cleanTitle || !chosen.length) {
      setNotice(copy.limit);
      return;
    }
    setSaving(true);
    setNotice("");
    const { data: header, error: headerError } = await supabase
      .from("lolz_story_highlights")
      .insert({
        owner_id: ownerId,
        title: cleanTitle,
        cover_url: chosen[0].media_url,
      })
      .select("id,owner_id,title,cover_url,created_at")
      .single();
    if (headerError || !header) {
      setNotice(copy.saveFailed + (headerError?.message || "Unknown error"));
      setSaving(false);
      return;
    }
    const payload = chosen.map((story, index) => ({
      highlight_id: header.id,
      owner_id: ownerId,
      story_id: String(story.id),
      media_url: story.media_url,
      caption: story.caption || "",
      media_type: /\.(mp4|mov|webm|m4v)(\?|$)/i.test(story.media_url || "") ? "video" : "image",
      media_filter: story.media_filter || "none",
      caption_position: story.caption_position || "bottom",
      audience: story.audience === "close_friends" ? "close_friends" : "everyone",
      position: index,
    }));
    const { data: inserted, error: itemsError } = await supabase
      .from("lolz_story_highlight_items")
      .insert(payload)
      .select("*");
    if (itemsError) {
      await supabase.from("lolz_story_highlights").delete().eq("id", header.id).eq("owner_id", ownerId);
      setNotice(copy.saveFailed + itemsError.message);
      setSaving(false);
      return;
    }
    setHighlights((current) => [{ ...header, items: inserted || [] }, ...current]);
    setCreating(false);
    setTitle("");
    setSelectedIds([]);
    setNotice(copy.saved);
    setSaving(false);
  }

  async function deleteHighlight(highlight) {
    if (!window.confirm(copy.deleteConfirm)) return;
    const { error } = await supabase
      .from("lolz_story_highlights")
      .delete()
      .eq("id", highlight.id)
      .eq("owner_id", currentUserId);
    if (error) {
      setNotice(error.message);
      return;
    }
    setHighlights((current) => current.filter((item) => item.id !== highlight.id));
    if (viewing?.id === highlight.id) setViewing(null);
  }

  const playbackStories = viewing
    ? viewing.items.map((item) => ({
        ...item,
        id: String(item.id),
        user_id: ownerId,
        created_at: item.created_at,
        media_url: item.media_url,
        author: ownerProfile,
        view_count: 0,
      }))
    : [];

  return (
    <section className="lolz-story-highlights" dir={isArabic ? "rtl" : "ltr"}>
      <div className="lolz-story-highlights-heading">
        <h2>{copy.title}</h2>
        {isOwner && (
          <button type="button" onClick={() => { setCreating(true); setNotice(""); }}>
            <Plus size={16} /> {copy.add}
          </button>
        )}
      </div>

      {loading ? <p className="lolz-story-highlights-muted"><LoaderCircle size={15} className="lolz-spin" /> {isArabic ? "جارٍ التحميل…" : "Loading…"}</p> : (
        <div className="lolz-story-highlight-list">
          {highlights.map((highlight) => (
            <div className="lolz-story-highlight-card" key={highlight.id}>
              <button type="button" className="lolz-story-highlight-open" onClick={() => setViewing(highlight)}>
                <span className="lolz-story-highlight-cover">
                  {highlight.cover_url ? <img src={highlight.cover_url} alt="" loading="lazy" /> : <Sparkles size={24} />}
                  <i><Play size={12} fill="currentColor" /></i>
                </span>
                <strong>{highlight.title}</strong>
                <small>{highlight.items.length} {isArabic ? "قصص" : "stories"}</small>
              </button>
              {isOwner && (
                <button type="button" className="lolz-story-highlight-delete" onClick={() => void deleteHighlight(highlight)} aria-label={copy.remove} title={copy.remove}>
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
          {!highlights.length && <p className="lolz-story-highlights-muted">{copy.empty}</p>}
        </div>
      )}

      {notice && <p className="lolz-story-highlights-notice" role="status">{notice}</p>}

      {creating && isOwner && (
        <div className="lolz-highlight-modal-backdrop" role="presentation">
          <section className="lolz-highlight-modal" role="dialog" aria-modal="true" aria-label={copy.create}>
            <header>
              <h3>{copy.create}</h3>
              <button type="button" onClick={() => setCreating(false)} aria-label={copy.cancel}><X size={18} /></button>
            </header>
            <label>{copy.name}
              <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={30} placeholder={isArabic ? "مثلاً: رحلاتي" : "e.g. Travel"} />
            </label>
            <p>{copy.choose}</p>
            {!availableStories.length ? <small>{copy.none}</small> : (
              <div className="lolz-highlight-story-picker">
                {availableStories.map((story) => (
                  <label key={story.id} className={selectedIds.includes(String(story.id)) ? "selected" : ""}>
                    <input type="checkbox" checked={selectedIds.includes(String(story.id))} onChange={() => toggleStory(story.id)} />
                    {story.media_url ? <img src={story.media_url} alt="" /> : <span>LOLZ</span>}
                    <small>{new Date(story.created_at).toLocaleDateString(isArabic ? "ar" : "en")}</small>
                  </label>
                ))}
              </div>
            )}
            <footer>
              <button type="button" className="secondary-button" onClick={() => setCreating(false)}>{copy.cancel}</button>
              <button type="button" className="primary-button" disabled={saving || !availableStories.length} onClick={() => void createHighlight()}>
                {saving ? <LoaderCircle size={15} className="lolz-spin" /> : null}{copy.save}
              </button>
            </footer>
          </section>
        </div>
      )}

      {viewing && playbackStories.length > 0 && (
        <StoryViewer
          stories={playbackStories}
          startStoryId={playbackStories[0].id}
          currentUserId={currentUserId}
          isArabic={isArabic}
          onClose={() => setViewing(null)}
        />
      )}
    </section>
  );
}
