import { useCallback, useEffect, useState } from "react";
import { BarChart3, Eye, Heart, MessageCircle, Users, Clapperboard, FileText, Download, RefreshCw } from "lucide-react";
import { supabase } from "./supabase";
import "./CreatorStudio.css";

export default function CreatorStudio({ user, isArabic = false }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({ posts: 0, videos: 0, stories: 0, followers: 0, likes: 0, comments: 0, views: 0, videoRows: [] });
  const [notice, setNotice] = useState("");
  const t = (ar, en) => isArabic ? ar : en;

  const load = useCallback(async (quiet = false) => {
    if (!user?.id) return;
    if (quiet) setRefreshing(true); else setLoading(true);
    setNotice("");
    try {
      const [postsResult, videosResult, storiesResult, followersResult] = await Promise.all([
        supabase.from("posts").select("id,content,created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("lolz_videos").select("id,caption,created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("stories").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("follows").select("id", { count: "exact", head: true }).eq("following_id", user.id),
      ]);
      if (postsResult.error) throw postsResult.error;
      if (videosResult.error) throw videosResult.error;
      const posts = postsResult.data || [];
      const videos = videosResult.data || [];
      const postIds = posts.map((item) => item.id);
      const videoIds = videos.map((item) => String(item.id));
      const [postLikes, postComments, videoLikes, videoComments, viewCounts] = await Promise.all([
        postIds.length ? supabase.from("post_likes").select("post_id").in("post_id", postIds) : Promise.resolve({ data: [] }),
        postIds.length ? supabase.from("comments").select("post_id").in("post_id", postIds) : Promise.resolve({ data: [] }),
        videoIds.length ? supabase.from("lolz_likes").select("video_id").in("video_id", videoIds) : Promise.resolve({ data: [] }),
        videoIds.length ? supabase.from("lolz_comments").select("video_id").in("video_id", videoIds) : Promise.resolve({ data: [] }),
        videoIds.length ? supabase.rpc("get_lolz_video_view_counts", { p_video_ids: videoIds }) : Promise.resolve({ data: [] }),
      ]);
      const viewMap = Object.fromEntries((viewCounts.data || []).map((row) => [String(row.video_id), Number(row.view_count || 0)]));
      const videoLikeMap = {};
      (videoLikes.data || []).forEach((row) => { videoLikeMap[row.video_id] = (videoLikeMap[row.video_id] || 0) + 1; });
      const videoCommentMap = {};
      (videoComments.data || []).forEach((row) => { videoCommentMap[row.video_id] = (videoCommentMap[row.video_id] || 0) + 1; });
      const videoRows = videos.map((video) => ({
        ...video,
        view_count: viewMap[String(video.id)] || 0,
        likes: videoLikeMap[video.id] || 0,
        comments: videoCommentMap[video.id] || 0,
      }));
      setStats({
        posts: posts.length,
        videos: videos.length,
        stories: storiesResult.count || 0,
        followers: followersResult.count || 0,
        likes: (postLikes.data || []).length + (videoLikes.data || []).length,
        comments: (postComments.data || []).length + (videoComments.data || []).length,
        views: videoRows.reduce((total, video) => total + video.view_count, 0),
        videoRows,
      });
    } catch (error) {
      setNotice((isArabic ? "تعذر تحميل الإحصائيات: " : "Could not load analytics: ") + error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id, isArabic]);

  useEffect(() => { void load(); }, [load]);

  function exportCsv() {
    const rows = [
      ["Video", "Created", "Views", "Likes", "Comments"],
      ...stats.videoRows.map((video) => [video.caption || "", video.created_at || "", video.view_count, video.likes, video.comments]),
    ];
    const csv = rows.map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "lolz-creator-analytics.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  const cards = [
    { label: t("مشاهدات الفيديوهات", "Video views"), value: stats.views, icon: Eye },
    { label: t("الإعجابات", "Likes"), value: stats.likes, icon: Heart },
    { label: t("التعليقات", "Comments"), value: stats.comments, icon: MessageCircle },
    { label: t("المتابعون", "Followers"), value: stats.followers, icon: Users },
    { label: t("المنشورات", "Posts"), value: stats.posts, icon: FileText },
    { label: t("فيديوهات LOLZ", "LOLZ videos"), value: stats.videos, icon: Clapperboard },
    { label: t("القصص المنشورة", "Stories published"), value: stats.stories, icon: BarChart3 },
  ];

  return (
    <section className="lolz-creator-studio" dir={isArabic ? "rtl" : "ltr"}>
      <header className="lolz-creator-header">
        <div><span className="eyebrow">LOLZ · CREATOR STUDIO</span><h1>{t("استوديو المنشئ", "Creator studio")}</h1><p>{t("تابع أداء محتواك وتفاعل مجتمعك معك.", "Track how your content performs and how your community engages.")}</p></div>
        <div className="lolz-creator-actions">
          <button type="button" onClick={() => void load(true)} disabled={refreshing}><RefreshCw size={16}/>{t("تحديث", "Refresh")}</button>
          <button type="button" onClick={exportCsv} disabled={!stats.videoRows.length}><Download size={16}/>{t("تصدير CSV", "Export CSV")}</button>
        </div>
      </header>
      {notice && <p className="lolz-creator-notice">{notice}</p>}
      {loading ? <div className="lolz-creator-empty">{t("جارٍ تحميل الإحصائيات…", "Loading analytics…")}</div> : (
        <>
          <div className="lolz-creator-grid">
            {cards.map(({ label, value, icon: Icon }) => <article className="lolz-creator-card" key={label}><span className="lolz-creator-icon"><Icon size={19}/></span><strong>{Number(value).toLocaleString(isArabic ? "ar" : "en")}</strong><span>{label}</span></article>)}
          </div>
          <section className="lolz-creator-videos">
            <div className="lolz-creator-section-heading"><h2>{t("أداء فيديوهاتك", "Your video performance")}</h2><span>{stats.videoRows.length}</span></div>
            {!stats.videoRows.length ? <div className="lolz-creator-empty">{t("لم تنشر فيديوهات بعد.", "You have not published any videos yet.")}</div> : stats.videoRows.map((video) => <article className="lolz-creator-video-row" key={video.id}><div className="lolz-creator-video-copy"><strong>{video.caption || t("فيديو بدون وصف", "Video without a caption")}</strong><small>{new Date(video.created_at).toLocaleDateString(isArabic ? "ar" : "en")}</small></div><span><Eye size={15}/>{video.view_count}</span><span><Heart size={15}/>{video.likes}</span><span><MessageCircle size={15}/>{video.comments}</span></article>)}
          </section>
          <p className="lolz-creator-footnote">{t("تعرض الإحصائيات البيانات المسجلة في LOLZ؛ وقد تختلف عن تحليلات المنصات الإعلانية أو بيانات المشاهدة الفورية.", "Analytics reflect activity recorded by LOLZ and may differ from advertising-platform or real-time analytics.")}</p>
        </>
      )}
    </section>
  );
}
