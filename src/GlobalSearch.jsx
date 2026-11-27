import { useState } from "react";
import { Search, UserRound, FileText, Clapperboard, UsersRound, Radio, LoaderCircle } from "lucide-react";
import { supabase } from "./supabase";
import "./GlobalSearch.css";

const FILTERS = [
  ["all", "الكل", "All"],
  ["people", "الأشخاص", "People"],
  ["posts", "المنشورات", "Posts"],
  ["videos", "الفيديوهات", "Videos"],
  ["groups", "المجموعات", "Groups"],
  ["channels", "القنوات", "Channels"],
];

export default function GlobalSearch({ user, isArabic = false, onOpenProfile, onOpenPage, onOpenGroup, onOpenChannel, onOpenVideo }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [results, setResults] = useState({ people: [], posts: [], videos: [], groups: [], channels: [] });
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [notice, setNotice] = useState("");

  const labels = {
    title: isArabic ? "ابحث في LOLZ بالكامل" : "Search all of LOLZ",
    subtitle: isArabic ? "الأشخاص والمنشورات والفيديوهات والمجموعات والقنوات في مكان واحد." : "People, posts, videos, groups and channels in one place.",
    placeholder: isArabic ? "اكتب ما تريد البحث عنه..." : "Search for anything...",
    search: isArabic ? "بحث" : "Search",
    noResults: isArabic ? "لا توجد نتائج مطابقة." : "No matching results.",
    openProfile: isArabic ? "عرض الملف" : "View profile",
    openFeed: isArabic ? "عرض المنشورات" : "View posts",
    openVideos: isArabic ? "فتح LOLZ" : "Open LOLZ",
    openGroups: isArabic ? "فتح المجموعات" : "Open groups",
    openChannels: isArabic ? "فتح القنوات" : "Open channels",
    people: isArabic ? "الأشخاص" : "People",
    posts: isArabic ? "المنشورات" : "Posts",
    videos: isArabic ? "فيديوهات LOLZ" : "LOLZ videos",
    groups: isArabic ? "المجموعات" : "Groups",
    channels: isArabic ? "القنوات" : "Channels",
    public: isArabic ? "عام" : "Public",
  };

  async function runSearch(event) {
    event?.preventDefault();
    const term = query.trim().replace(/[%_,()]/g, " ").replace(/\s+/g, " ");
    if (term.length < 2) {
      setNotice(isArabic ? "اكتب حرفين على الأقل للبحث." : "Enter at least two characters.");
      setResults({ people: [], posts: [], videos: [], groups: [], channels: [] });
      setSearched(false);
      return;
    }

    setLoading(true);
    setNotice("");
    setSearched(true);
    const pattern = `%${term}%`;
    const tasks = {
      people: supabase.from("profiles").select("id,username,display_name,full_name,avatar_url,is_verified").or(`username.ilike.${pattern},display_name.ilike.${pattern},full_name.ilike.${pattern}`).neq("id", user?.id || "00000000-0000-0000-0000-000000000000").limit(15),
      posts: supabase.from("posts").select("id,user_id,content,image_url,created_at").ilike("content", pattern).order("created_at", { ascending: false }).limit(15),
      videos: supabase.from("lolz_videos").select("id,user_id,caption,video_url,created_at").ilike("caption", pattern).order("created_at", { ascending: false }).limit(15),
      groups: supabase.from("groups").select("id,name,description,avatar_url,is_public,created_by").or(`name.ilike.${pattern},description.ilike.${pattern}`).limit(15),
      channels: supabase.from("channels").select("id,name,description,avatar_url,is_public,created_by").or(`name.ilike.${pattern},description.ilike.${pattern}`).limit(15),
    };
    const entries = Object.entries(tasks);
    const responses = await Promise.all(entries.map(([, task]) => task));
    const next = {};
    let failed = 0;
    entries.forEach(([key], index) => {
      const response = responses[index];
      if (response.error) {
        failed += 1;
        console.warn("LOLZ global search failed for", key, response.error.message);
      }
      next[key] = response.data || [];
    });
    setResults(next);
    if (failed === entries.length) {
      setNotice(isArabic ? "تعذر تنفيذ البحث. تحقق من الاتصال وحاول مجدداً." : "Search could not be completed. Check your connection and try again.");
    }
    setLoading(false);
  }

  const visibleKeys = filter === "all" ? ["people", "posts", "videos", "groups", "channels"] : [filter];
  const hasResults = visibleKeys.some((key) => results[key]?.length);
  const sectionIcons = { people: UserRound, posts: FileText, videos: Clapperboard, groups: UsersRound, channels: Radio };

  function resultAction(kind, item) {
    if (kind === "people") return onOpenProfile?.(item.id);
    if (kind === "posts") return onOpenProfile?.(item.user_id);
    if (kind === "videos") return onOpenVideo?.(item.id);
    if (kind === "groups") return onOpenGroup?.(item.id);
    if (kind === "channels") return onOpenChannel?.(item.id);
    return onOpenPage?.("home");
  }

  function resultLabel(kind) {
    return labels[kind];
  }

  return (
    <section className="lolz-global-search" dir={isArabic ? "rtl" : "ltr"}>
      <header className="lolz-global-search-header">
        <span className="eyebrow">LOLZ · DISCOVER EVERYTHING</span>
        <h1>{labels.title}</h1>
        <p>{labels.subtitle}</p>
      </header>
      <form className="lolz-global-search-form" onSubmit={runSearch}>
        <Search size={20} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={labels.placeholder} aria-label={labels.placeholder}/>
        <button type="submit" disabled={loading}>{loading ? <LoaderCircle className="lolz-search-spin" size={18}/> : labels.search}</button>
      </form>
      <div className="lolz-global-search-filters" role="group" aria-label={isArabic ? "نوع النتائج" : "Result type"}>
        {FILTERS.map(([id, ar, en]) => (
          <button type="button" key={id} className={filter === id ? "active" : ""} onClick={() => setFilter(id)}>{isArabic ? ar : en}</button>
        ))}
      </div>
      {notice && <p className="lolz-global-search-notice" role="status">{notice}</p>}
      {loading ? <div className="lolz-global-search-empty"><LoaderCircle className="lolz-search-spin" size={24}/></div> : null}
      {!loading && searched && !hasResults && !notice ? <div className="lolz-global-search-empty">{labels.noResults}</div> : null}
      {!loading && visibleKeys.map((kind) => {
        const items = results[kind] || [];
        if (!items.length) return null;
        const Icon = sectionIcons[kind];
        return (
          <section className="lolz-search-section" key={kind}>
            <div className="lolz-search-section-title"><Icon size={18}/><h2>{resultLabel(kind)}</h2><span>{items.length}</span></div>
            <div className="lolz-search-results">
              {items.map((item) => {
                const title = kind === "people" ? (item.display_name || item.full_name || item.username || "LOLZ member") : (item.name || item.caption || item.content || resultLabel(kind));
                const subtitle = kind === "people" ? (item.username ? `@${item.username}` : "") : kind === "posts" || kind === "videos" ? new Date(item.created_at).toLocaleDateString(isArabic ? "ar" : "en") : (item.is_public ? labels.public : (isArabic ? "خاص" : "Private"));
                const detail = kind === "posts" || kind === "videos" ? (item.content || item.caption || "") : kind === "people" ? "" : (item.description || "");
                return (
                  <button className="lolz-search-result" type="button" key={item.id} onClick={() => resultAction(kind, item)}>
                    {kind === "people" && item.avatar_url ? <img src={item.avatar_url} alt="" /> : <span className="lolz-search-result-icon"><Icon size={20}/></span>}
                    <span className="lolz-search-result-copy"><strong>{title}</strong>{subtitle && <small>{subtitle}</small>}{detail && <span>{detail.slice(0, 130)}</span>}</span>
                    <span className="lolz-search-result-open">{kind === "people" ? labels.openProfile : kind === "videos" ? labels.openVideos : kind === "posts" ? labels.openFeed : kind === "groups" ? labels.openGroups : labels.openChannels}</span>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </section>
  );
}
