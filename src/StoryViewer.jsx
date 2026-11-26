import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Eye, Flag, X } from "lucide-react";
import "./StoryViewer.css";

export default function StoryViewer({
  stories = [],
  startStoryId,
  currentUserId,
  isArabic = false,
  onClose,
  onView,
  onReport,
}) {
  const orderedStories = useMemo(() => {
    const groups = new Map();

    for (const story of stories) {
      const key = story.user_id || "unknown";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(story);
    }

    return [...groups.values()].flatMap((group) =>
      [...group].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
    );
  }, [stories]);

  const initialIndex = Math.max(
    0,
    orderedStories.findIndex((story) => String(story.id) === String(startStoryId))
  );
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    setActiveIndex(initialIndex);
    setProgress(0);
  }, [initialIndex, startStoryId]);

  const story = orderedStories[activeIndex] || null;

  function close() {
    onClose?.();
  }

  function next() {
    if (activeIndex >= orderedStories.length - 1) {
      close();
      return;
    }
    setProgress(0);
    setActiveIndex((value) => Math.min(value + 1, orderedStories.length - 1));
  }

  function previous() {
    setProgress(0);
    setActiveIndex((value) => Math.max(0, value - 1));
  }

  useEffect(() => {
    if (!story) return undefined;

    if (story.user_id !== currentUserId) {
      onView?.(story);
    }

    setProgress(0);
    const startedAt = Date.now();
    const duration = 6500;
    const timer = window.setInterval(() => {
      const value = Math.min(100, ((Date.now() - startedAt) / duration) * 100);
      setProgress(value);
      if (value >= 100) {
        window.clearInterval(timer);
        if (activeIndex >= orderedStories.length - 1) {
          onClose?.();
        } else {
          setActiveIndex(activeIndex + 1);
        }
      }
    }, 80);

    return () => window.clearInterval(timer);
  }, [story?.id, activeIndex, currentUserId, onView, onClose, orderedStories.length]);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === "Escape") close();
      if (event.key === "ArrowRight") next();
      if (event.key === "ArrowLeft") previous();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  if (!story) return null;

  const author = story.author || {};
  const name = author.display_name || author.username || (isArabic ? "عضو" : "Member");
  const isVideo = /\.(mp4|webm|mov|m4v)(\?.*)?$/i.test(story.media_url || "");

  return (
    <div className="lolz-story-overlay" role="dialog" aria-modal="true" aria-label={isArabic ? "عارض القصص" : "Stories"}>
      <div className="lolz-story-frame" dir={isArabic ? "rtl" : "ltr"}>
        <div className="lolz-story-media">
          {isVideo ? (
            <video
              key={story.id}
              src={story.media_url}
              autoPlay
              playsInline
              onEnded={next}
              onError={next}
            />
          ) : (
            <img src={story.media_url} alt={story.caption || name} />
          )}
        </div>

        <div className="lolz-story-shade" />
        <div className="lolz-story-progress" aria-hidden="true">
          {orderedStories.map((item, index) => (
            <span className="lolz-story-progress-track" key={item.id}>
              <i
                style={{
                  width: index < activeIndex ? "100%" : index === activeIndex ? `${progress}%` : "0%",
                }}
              />
            </span>
          ))}
        </div>

        <header className="lolz-story-header">
          <div className="lolz-story-author">
            <img
              src={author.avatar_url || ""}
              alt=""
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
            <strong>{name}</strong>
            <time>{new Date(story.created_at).toLocaleTimeString(isArabic ? "ar" : "en", { hour: "2-digit", minute: "2-digit" })}</time>
          </div>
          <div className="lolz-story-tools">
            {story.user_id !== currentUserId && (
              <button
                type="button"
                aria-label={isArabic ? "إبلاغ عن القصة" : "Report story"}
                title={isArabic ? "إبلاغ" : "Report"}
                onClick={() => onReport?.({ type: "story", id: story.id, targetUserId: story.user_id })}
              >
                <Flag size={19} />
              </button>
            )}
            <button type="button" onClick={close} aria-label={isArabic ? "إغلاق" : "Close"}>
              <X size={22} />
            </button>
          </div>
        </header>

        <button className="lolz-story-hit lolz-story-hit-left" type="button" onClick={previous} aria-label={isArabic ? "القصة السابقة" : "Previous story"} />
        <button className="lolz-story-hit lolz-story-hit-right" type="button" onClick={next} aria-label={isArabic ? "القصة التالية" : "Next story"} />

        {story.caption && <p className="lolz-story-caption">{story.caption}</p>}

        {story.user_id === currentUserId && (
          <div className="lolz-story-views">
            <Eye size={16} />
            <span>{story.view_count || 0} {isArabic ? "مشاهدة" : "views"}</span>
          </div>
        )}

        <nav className="lolz-story-arrows" aria-label={isArabic ? "التنقل بين القصص" : "Story navigation"}>
          <button type="button" onClick={previous} aria-label={isArabic ? "السابق" : "Previous"} disabled={activeIndex === 0}>
            <ChevronLeft size={22} />
          </button>
          <button type="button" onClick={next} aria-label={isArabic ? "التالي" : "Next"}>
            <ChevronRight size={22} />
          </button>
        </nav>
      </div>
    </div>
  );
}
