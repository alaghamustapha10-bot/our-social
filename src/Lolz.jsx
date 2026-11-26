
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Play,
  Heart,
  MessageCircle,
  Plus,
  X,
  Send,
  LoaderCircle,
  Video,
  Volume2,
  VolumeX,
  Flag,
} from "lucide-react";
import { supabase } from "./supabase";
import "./Lolz.css";

function formatDate(date) {
  return new Date(date).toLocaleDateString(
    document.documentElement.lang === "ar" ? "ar" : "en",
    { day: "numeric", month: "short" }
  );
}

export default function Lolz({ user, blockedUserIds = [], onReport }) {
  const fileRef = useRef(null);
  const videoRefs = useRef({});
  const feedRef = useRef(null);

  const [videos, setVideos] = useState([]);
  const [file, setFile] = useState(null);
  const [caption, setCaption] = useState("");
  const [likes, setLikes] = useState({});
  const [comments, setComments] = useState({});
  const [commentText, setCommentText] = useState({});
  const [openComments, setOpenComments] = useState({});
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [soundOn, setSoundOn] = useState(false);
  const [pausedVideoId, setPausedVideoId] = useState(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  // تشغيل الفيديو الظاهر وإيقاف بقية الفيديوهات
  useEffect(() => {
    const elements = Object.values(videoRefs.current).filter(Boolean);

    if (!elements.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const video = entry.target;

          if (entry.isIntersecting && entry.intersectionRatio >= 0.65) {
            video.muted = !soundOn;
            video.play().catch(() => {});
          } else {
            video.pause();
          }
        });
      },
      {
        root: feedRef.current,
        threshold: [0, 0.3, 0.65, 1],
      }
    );

    elements.forEach((video) => observer.observe(video));

    return () => {
      observer.disconnect();
      elements.forEach((video) => video.pause());
    };
  }, [videos, soundOn]);

  const loadVideos = useCallback(async () => {
    setLoading(true);
    setNotice("");

    const { data, error } = await supabase
      .from("lolz_videos")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setNotice("تعذر تحميل الفيديوهات: " + error.message);
      setLoading(false);
      return;
    }

    const videoRows = (data || []).filter((video) => !blockedUserIds.includes(video.user_id));
    const userIds = [...new Set(videoRows.map((v) => v.user_id))];
    const videoIds = videoRows.map((v) => v.id);

    let profiles = [];
    let likeRows = [];
    let commentRows = [];

    if (userIds.length) {
      const result = await supabase
        .from("profiles")
        .select("id, username, display_name, full_name, avatar_url")
        .in("id", userIds);

      profiles = result.data || [];
    }

    if (videoIds.length) {
      const [likesResult, commentsResult] = await Promise.all([
        supabase
          .from("lolz_likes")
          .select("*")
          .in("video_id", videoIds),

        supabase
          .from("lolz_comments")
          .select("*")
          .in("video_id", videoIds)
          .order("created_at", { ascending: true }),
      ]);

      likeRows = likesResult.data || [];
      commentRows = (commentsResult.data || []).filter((comment) => !blockedUserIds.includes(comment.user_id));
    }

    const commentUserIds = [
      ...new Set(commentRows.map((c) => c.user_id)),
    ];

    let commentProfiles = [];

    if (commentUserIds.length) {
      const result = await supabase
        .from("profiles")
        .select("id, username, display_name, full_name, avatar_url")
        .in("id", commentUserIds);

      commentProfiles = result.data || [];
    }

    const profileMap = Object.fromEntries(
      profiles.map((p) => [p.id, p])
    );

    const commentProfileMap = Object.fromEntries(
      commentProfiles.map((p) => [p.id, p])
    );

    setVideos(
      videoRows.map((video) => ({
        ...video,
        profile: profileMap[video.user_id] || null,
      }))
    );

    const likeMap = {};

    likeRows.forEach((like) => {
      if (!likeMap[like.video_id]) {
        likeMap[like.video_id] = { count: 0, liked: false };
      }

      likeMap[like.video_id].count += 1;

      if (like.user_id === user?.id) {
        likeMap[like.video_id].liked = true;
      }
    });

    setLikes(likeMap);

    const commentMap = {};

    commentRows.forEach((comment) => {
      if (!commentMap[comment.video_id]) {
        commentMap[comment.video_id] = [];
      }

      commentMap[comment.video_id].push({
        ...comment,
        profile: commentProfileMap[comment.user_id] || null,
      });
    });

    setComments(commentMap);
    setLoading(false);
  }, [blockedUserIds, user?.id]);

  useEffect(() => {
    void loadVideos();
  }, [loadVideos]);

  async function publishVideo(e) {
    e.preventDefault();

    if (!user) {
      setNotice("سجّل الدخول أولاً لنشر فيديو.");
      return;
    }

    if (!file) {
      setNotice("اختر فيديو أولاً.");
      return;
    }

    if (!file.type.startsWith("video/")) {
      setNotice("يرجى اختيار ملف فيديو صالح.");
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      setNotice("حجم الفيديو يجب ألا يتجاوز 100 ميغابايت.");
      return;
    }

    setBusy(true);
    setNotice("");

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${user.id}/lolz/${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from("social-media")
      .upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });

    if (uploadError) {
      setNotice("فشل رفع الفيديو: " + uploadError.message);
      setBusy(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("social-media")
      .getPublicUrl(path);

    const { error: insertError } = await supabase
      .from("lolz_videos")
      .insert({
        user_id: user.id,
        video_url: urlData.publicUrl,
        caption: caption.trim(),
      });

    if (insertError) {
      setNotice("تم رفع الملف لكن تعذر نشره: " + insertError.message);
      setBusy(false);
      return;
    }

    setFile(null);
    setCaption("");
    setUploadOpen(false);

    if (fileRef.current) {
      fileRef.current.value = "";
    }

    setNotice("تم نشر فيديو LOLZ بنجاح!");
    setBusy(false);

    await loadVideos();

    if (feedRef.current) {
      feedRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  async function toggleLike(videoId) {
    if (!user) {
      setNotice("سجّل الدخول للإعجاب بالفيديوهات.");
      return;
    }

    const current = likes[videoId] || {
      count: 0,
      liked: false,
    };

    setLikes((prev) => ({
      ...prev,
      [videoId]: {
        count: current.count + (current.liked ? -1 : 1),
        liked: !current.liked,
      },
    }));

    const result = current.liked
      ? await supabase
          .from("lolz_likes")
          .delete()
          .eq("video_id", videoId)
          .eq("user_id", user.id)
      : await supabase
          .from("lolz_likes")
          .insert({ video_id: videoId, user_id: user.id });

    if (result.error) {
      setNotice("تعذر تحديث الإعجاب.");
      await loadVideos();
    }
  }

  async function addComment(videoId) {
    const content = (commentText[videoId] || "").trim();

    if (!user) {
      setNotice("سجّل الدخول لإضافة تعليق.");
      return;
    }

    if (!content) return;

    const { error } = await supabase.from("lolz_comments").insert({
      video_id: videoId,
      user_id: user.id,
      content,
    });

    if (error) {
      setNotice("تعذر نشر التعليق: " + error.message);
      return;
    }

    setCommentText((prev) => ({
      ...prev,
      [videoId]: "",
    }));

    await loadVideos();
  }

  function displayName(profile) {
    return (
      profile?.display_name ||
      profile?.full_name ||
      profile?.username ||
      "OUR SOCIAL member"
    );
  }

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);

    Object.values(videoRefs.current).forEach((video) => {
      if (video) video.muted = !next;
    });
  }

  function togglePlayback(videoId) {
    const video = videoRefs.current[videoId];

    if (!video) return;

    if (video.paused) {
      video.play().catch(() => {});
      setPausedVideoId(null);
    } else {
      video.pause();
      setPausedVideoId(videoId);
    }
  }

  function toggleComments(videoId) {
    setOpenComments((prev) => ({
      ...prev,
      [videoId]: !prev[videoId],
    }));
  }

  function openUpload() {
    if (!user) {
      setNotice("سجّل الدخول أولاً لنشر فيديو.");
      return;
    }

    setUploadOpen(true);
  }

  return (
    <main className="lolz-page">
      <header className="lolz-header">
        <div className="lolz-heading-copy">
          <span className="lolz-kicker">LOLZ · VIDEO FEED</span>
          <h1>LOLZ<span>✦</span></h1>
          <p>لحظات قصيرة، ومجتمع لا يتوقف.</p>
        </div>

        <button
          className="lolz-create-button"
          onClick={openUpload}
          type="button"
        >
          <Plus size={20} />
          <span>إنشاء فيديو</span>
        </button>
      </header>

      {notice && (
        <div className="lolz-notice" role="status">
          <span>{notice}</span>
          <button onClick={() => setNotice("")} aria-label="إغلاق">
            <X size={17} />
          </button>
        </div>
      )}

      {uploadOpen && (
        <div
          className="lolz-upload-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !busy) {
              setUploadOpen(false);
            }
          }}
        >
          <section className="lolz-upload-modal">
            <div className="lolz-modal-heading">
              <div>
                <span className="lolz-kicker">SHARE A MOMENT</span>
                <h2>أنشئ فيديو جديداً</h2>
              </div>

              <button
                type="button"
                onClick={() => !busy && setUploadOpen(false)}
                aria-label="إغلاق"
                disabled={busy}
              >
                <X size={21} />
              </button>
            </div>

            <form className="lolz-upload-form" onSubmit={publishVideo}>
              <input
                ref={fileRef}
                type="file"
                accept="video/*"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                hidden
              />

              <button
                type="button"
                className="lolz-file-picker"
                onClick={() => fileRef.current?.click()}
              >
                <Video size={27} />
                <strong>
                  {file ? "تغيير الفيديو" : "اختر فيديو من جهازك"}
                </strong>
                <span>
                  {file
                    ? file.name
                    : "MP4 أو أي صيغة فيديو مدعومة · حتى 100 MB"}
                </span>
              </button>

              {file && (
                <button
                  type="button"
                  className="lolz-remove-file"
                  onClick={() => {
                    setFile(null);
                    if (fileRef.current) fileRef.current.value = "";
                  }}
                >
                  <X size={15} />
                  إزالة الملف
                </button>
              )}

              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="اكتب وصفاً لفيديوك..."
                maxLength={500}
                rows={3}
              />

              <button
                type="submit"
                className="lolz-publish-button"
                disabled={busy || !file}
              >
                {busy ? (
                  <>
                    <LoaderCircle className="lolz-spin" size={18} />
                    جارٍ رفع الفيديو...
                  </>
                ) : (
                  <>
                    <Plus size={18} />
                    نشر الفيديو
                  </>
                )}
              </button>
            </form>
          </section>
        </div>
      )}

      <div className="lolz-feed-heading">
        <div>
          <span className="lolz-kicker">THE COMMUNITY</span>
          <h2>اكتشف الفيديوهات</h2>
        </div>
        <span className="lolz-video-count">{videos.length} فيديو</span>
      </div>

      {loading ? (
        <div className="lolz-empty">
          <LoaderCircle className="lolz-spin" size={30} />
          <p>جارٍ تحميل الفيديوهات...</p>
        </div>
      ) : videos.length === 0 ? (
        <div className="lolz-empty">
          <div className="lolz-empty-icon">
            <Video size={32} />
          </div>
          <h3>البداية من هنا!</h3>
          <p>لا توجد فيديوهات بعد. كن أول من يشارك لحظته.</p>
          <button onClick={openUpload} type="button">
            <Plus size={18} />
            أضف أول فيديو
          </button>
        </div>
      ) : (
        <section
          className="lolz-feed"
          ref={feedRef}
          aria-label="فيديوهات LOLZ"
        >
          {videos.map((video) => {
            const likeInfo = likes[video.id] || {
              count: 0,
              liked: false,
            };

            const videoComments = comments[video.id] || [];
            const profile = video.profile;
            const isCommentsOpen = !!openComments[video.id];

            return (
              <article className="lolz-video-card" key={video.id}>
                <div className="lolz-video-stage">
                  <video
                    ref={(element) => {
                      if (element) {
                        videoRefs.current[video.id] = element;
                      } else {
                        delete videoRefs.current[video.id];
                      }
                    }}
                    className="lolz-video-element"
                    src={video.video_url}
                    playsInline
                    loop
                    muted={!soundOn}
                    preload="metadata"
                    onClick={() => togglePlayback(video.id)}
                  />

                  {pausedVideoId === video.id && (
                    <button
                      className="lolz-play-overlay"
                      onClick={() => togglePlayback(video.id)}
                      aria-label="تشغيل الفيديو"
                      type="button"
                    >
                      <Play size={34} fill="currentColor" />
                    </button>
                  )}

                  <div className="lolz-video-top">
                    <span className="lolz-label">✦ LOLZ</span>

                    {video.user_id !== user?.id && (
                      <button
                        className="lolz-report-button"
                        type="button"
                        onClick={() =>
                          onReport?.({
                            type: "video",
                            id: video.id,
                            targetUserId: video.user_id,
                          })
                        }
                        aria-label="Report video"
                        title="Report video"
                      >
                        <Flag size={17} />
                      </button>
                    )}
                    <button
                      className="lolz-sound-button"
                      onClick={toggleSound}
                      aria-label={soundOn ? "كتم الصوت" : "تشغيل الصوت"}
                      type="button"
                    >
                      {soundOn ? (
                        <Volume2 size={19} />
                      ) : (
                        <VolumeX size={19} />
                      )}
                    </button>
                  </div>

                  <div className="lolz-video-actions">
                    <button
                      className={likeInfo.liked ? "is-liked" : ""}
                      onClick={() => toggleLike(video.id)}
                      aria-label="إعجاب"
                      type="button"
                    >
                      <span className="lolz-action-icon">
                        <Heart
                          size={26}
                          fill={likeInfo.liked ? "currentColor" : "none"}
                        />
                      </span>
                      <span>{likeInfo.count}</span>
                    </button>

                    <button
                      className={isCommentsOpen ? "is-active" : ""}
                      onClick={() => toggleComments(video.id)}
                      aria-label="التعليقات"
                      type="button"
                    >
                      <span className="lolz-action-icon">
                        <MessageCircle size={26} />
                      </span>
                      <span>{videoComments.length}</span>
                    </button>
                  </div>

                  <div className="lolz-video-bottom">
                    <div className="lolz-video-user">
                      {profile?.avatar_url ? (
                        <img src={profile.avatar_url} alt="" />
                      ) : (
                        <div className="lolz-avatar-fallback">
                          {displayName(profile).charAt(0).toUpperCase()}
                        </div>
                      )}

                      <div className="lolz-user-details">
                        <strong>{displayName(profile)}</strong>
                        <span>
                          {profile?.username
                            ? `@${profile.username}`
                            : "OUR SOCIAL"}
                          {" · "}
                          {formatDate(video.created_at)}
                        </span>
                      </div>
                    </div>

                    {video.caption && (
                      <p className="lolz-caption">{video.caption}</p>
                    )}
                  </div>
                </div>

                <aside
                  className={`lolz-side-panel ${
                    isCommentsOpen ? "comments-open" : ""
                  }`}
                >
                  <div className="lolz-side-user">
                    {profile?.avatar_url ? (
                      <img src={profile.avatar_url} alt="" />
                    ) : (
                      <div className="lolz-avatar-fallback">
                        {displayName(profile).charAt(0).toUpperCase()}
                      </div>
                    )}

                    <div className="lolz-user-details">
                      <strong>{displayName(profile)}</strong>
                      <span>
                        {profile?.username
                          ? `@${profile.username}`
                          : "OUR SOCIAL"}
                      </span>
                    </div>
                  </div>

                  {video.caption && (
                    <p className="lolz-side-caption">{video.caption}</p>
                  )}

                  <div className="lolz-side-divider" />

                  <div className="lolz-comments-heading">
                    <strong>التعليقات</strong>
                    <span>{videoComments.length}</span>
                    <button
                      type="button"
                      className="lolz-mobile-close"
                      onClick={() => toggleComments(video.id)}
                      aria-label="إغلاق التعليقات"
                    >
                      <X size={19} />
                    </button>
                  </div>

                  <div className="lolz-comments-list">
                    {videoComments.length === 0 ? (
                      <p className="lolz-no-comments">
                        لا توجد تعليقات بعد. كن أول من يعلّق.
                      </p>
                    ) : (
                      videoComments.map((comment) => (
                        <div className="lolz-comment" key={comment.id}>
                          {comment.profile?.avatar_url ? (
                            <img
                              src={comment.profile.avatar_url}
                              alt=""
                            />
                          ) : (
                            <div className="lolz-comment-avatar">
                              {displayName(comment.profile)
                                .charAt(0)
                                .toUpperCase()}
                            </div>
                          )}

                          <div className="lolz-comment-content">
                            <strong>{displayName(comment.profile)}</strong>
                            <p>{comment.content}</p>
                            {comment.user_id !== user?.id && (
                              <button
                                type="button"
                                className="lolz-comment-report"
                                onClick={() =>
                                  onReport?.({
                                    type: "comment",
                                    id: comment.id,
                                    targetUserId: comment.user_id,
                                  })
                                }
                              >
                                الإبلاغ عن التعليق
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <form
                    className="lolz-comment-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      addComment(video.id);
                    }}
                  >
                    <input
                      value={commentText[video.id] || ""}
                      onChange={(e) =>
                        setCommentText((prev) => ({
                          ...prev,
                          [video.id]: e.target.value,
                        }))
                      }
                      placeholder="اكتب تعليقاً..."
                      maxLength={1000}
                    />

                    <button type="submit" aria-label="إرسال التعليق">
                      <Send size={18} />
                    </button>
                  </form>
                </aside>
              </article>
            );
          })}
        </section>
      )}

      {!loading && videos.length > 1 && (
        <p className="lolz-feed-hint">
          اسحب للأعلى لمشاهدة الفيديو التالي
        </p>
      )}
    </main>
  );
}
