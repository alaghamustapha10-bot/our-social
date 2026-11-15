
import React, { useEffect, useRef, useState } from "react";
import {
  Play, Heart, MessageCircle, Plus, Upload,
  X, Send, LoaderCircle, Video, Volume2, VolumeX
} from "lucide-react";
import { supabase } from "./supabase";
import "./Lolz.css";

function formatDate(date) {
  return new Date(date).toLocaleDateString("ar", {
    day: "numeric",
    month: "short",
  });
}

export default function Lolz({ user }) {
  const fileRef = useRef(null);
  const videoRefs = useRef({});
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

  useEffect(() => {
    loadVideos();
  }, []);

  // تشغيل الفيديو الظاهر وإيقاف الفيديوهات الأخرى
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
      { threshold: [0, 0.3, 0.65, 1] }
    );

    elements.forEach((video) => observer.observe(video));

    return () => {
      observer.disconnect();
      elements.forEach((video) => video.pause());
    };
  }, [videos, soundOn]);

  async function loadVideos() {
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

    const videoRows = data || [];
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
        supabase.from("lolz_likes").select("*").in("video_id", videoIds),
        supabase.from("lolz_comments")
          .select("*")
          .in("video_id", videoIds)
          .order("created_at", { ascending: true }),
      ]);

      likeRows = likesResult.data || [];
      commentRows = commentsResult.data || [];
    }

    const commentUserIds = [
      ...new Set(commentRows.map((c) => c.user_id))
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
  }

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

    if (fileRef.current) {
      fileRef.current.value = "";
    }

    setNotice("تم نشر فيديو LOLZ بنجاح!");
    setBusy(false);
    await loadVideos();
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
      ? await supabase.from("lolz_likes")
          .delete()
          .eq("video_id", videoId)
          .eq("user_id", user.id)
      : await supabase.from("lolz_likes")
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
    return profile?.display_name ||
      profile?.full_name ||
      profile?.username ||
      "OUR SOCIAL member";
  }

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);

    Object.values(videoRefs.current).forEach((video) => {
      if (video) video.muted = !next;
    });
  }

  return (
    <main className="lolz-page">

      <header className="lolz-header">
        <div>
          <span className="lolz-kicker">OUR SOCIAL SHORT VIDEOS</span>
          <h1>LOLZ<span>✦</span></h1>
          <p>لحظات قصيرة، إبداع بلا حدود.</p>
        </div>

        <button
          className="lolz-create-button"
          onClick={() => fileRef.current?.click()}
        >
          <Plus size={19} />
          <span>أنشئ فيديو</span>
        </button>
      </header>

      <section className="lolz-upload-card">
        <div className="lolz-upload-icon">
          <Video size={25} />
        </div>

        <div className="lolz-upload-copy">
          <h3>شارك لحظتك مع الجميع</h3>
          <p>ارفع فيديو قصيراً واجعل مجتمع OUR SOCIAL يشاهده.</p>
        </div>

        <button
          className="lolz-upload-trigger"
          onClick={() => fileRef.current?.click()}
        >
          <Upload size={17} />
          اختيار فيديو
        </button>

        <form className="lolz-upload-form" onSubmit={publishVideo}>
          <input
            ref={fileRef}
            type="file"
            accept="video/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            hidden
          />

          {file && (
            <div className="lolz-selected-file">
              <Video size={17} />
              <span>{file.name}</span>
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  if (fileRef.current) fileRef.current.value = "";
                }}
                aria-label="إزالة الفيديو"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {file && (
            <>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="اكتب وصفاً لفيديوك..."
                maxLength={500}
                rows={2}
              />

              <button
                type="submit"
                className="lolz-publish-button"
                disabled={busy}
              >
                {busy ? (
                  <>
                    <LoaderCircle className="lolz-spin" size={17} />
                    جارٍ النشر...
                  </>
                ) : (
                  <>
                    <Play size={17} />
                    نشر الفيديو
                  </>
                )}
              </button>
            </>
          )}
        </form>
      </section>

      {notice && (
        <div className="lolz-notice">
          <span>{notice}</span>
          <button onClick={() => setNotice("")} aria-label="إغلاق">
            <X size={16} />
          </button>
        </div>
      )}

      <div className="lolz-section-heading">
        <div>
          <span className="lolz-kicker">THE COMMUNITY FEED</span>
          <h2>اكتشف الفيديوهات</h2>
        </div>

        <span className="lolz-video-count">
          {videos.length} فيديو
        </span>
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
          <p>لا توجد فيديوهات بعد. كن أول من يشارك لحظته في LOLZ.</p>
          <button onClick={() => fileRef.current?.click()}>
            <Plus size={17} /> أضف أول فيديو
          </button>
        </div>
      ) : (
        <section className="lolz-feed">
          {videos.map((video) => {
            const likeInfo = likes[video.id] || {
              count: 0,
              liked: false,
            };

            const videoComments = comments[video.id] || [];
            const profile = video.profile;

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
                    controls
                  />

                  <div className="lolz-video-top">
                    <span className="lolz-label">✦ LOLZ</span>

                    <button
                      className="lolz-sound-button"
                      onClick={toggleSound}
                      aria-label={soundOn ? "كتم الصوت" : "تشغيل الصوت"}
                    >
                      {soundOn
                        ? <Volume2 size={19} />
                        : <VolumeX size={19} />
                      }
                    </button>
                  </div>

                  <div className="lolz-video-overlay">
                    <div className="lolz-video-user">
                      {profile?.avatar_url ? (
                        <img src={profile.avatar_url} alt="" />
                      ) : (
                        <div className="lolz-avatar-fallback">
                          {displayName(profile).charAt(0).toUpperCase()}
                        </div>
                      )}

                      <div>
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
                      <p className="lolz-caption">
                        {video.caption}
                      </p>
                    )}
                  </div>

                  <div className="lolz-video-actions">
                    <button
                      className={likeInfo.liked ? "is-liked" : ""}
                      onClick={() => toggleLike(video.id)}
                    >
                      <Heart
                        size={25}
                        fill={likeInfo.liked ? "currentColor" : "none"}
                      />
                      <span>{likeInfo.count}</span>
                    </button>

                    <button
                      className={openComments[video.id] ? "is-active" : ""}
                      onClick={() => setOpenComments((prev) => ({
                        ...prev,
                        [video.id]: !prev[video.id],
                      }))}
                    >
                      <MessageCircle size={25} />
                      <span>{videoComments.length}</span>
                    </button>
                  </div>
                </div>

                {openComments[video.id] && (
                  <div className="lolz-comments">
                    <div className="lolz-comments-list">
                      {videoComments.length === 0 ? (
                        <p className="lolz-no-comments">
                          لا توجد تعليقات بعد. كن أول من يعلّق.
                        </p>
                      ) : (
                        videoComments.map((comment) => (
                          <div className="lolz-comment" key={comment.id}>
                            {comment.profile?.avatar_url ? (
                              <img src={comment.profile.avatar_url} alt="" />
                            ) : (
                              <div className="lolz-comment-avatar">
                                {displayName(comment.profile)
                                  .charAt(0).toUpperCase()}
                              </div>
                            )}

                            <div>
                              <strong>
                                {displayName(comment.profile)}
                              </strong>
                              <p>{comment.content}</p>
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
                        onChange={(e) => setCommentText((prev) => ({
                          ...prev,
                          [video.id]: e.target.value,
                        }))}
                        placeholder="اكتب تعليقاً..."
                        maxLength={1000}
                      />

                      <button type="submit" aria-label="إرسال التعليق">
                        <Send size={17} />
                      </button>
                    </form>
                  </div>
                )}

              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
