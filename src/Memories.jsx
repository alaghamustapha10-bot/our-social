import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";
import { Archive, RefreshCw } from "lucide-react";

export default function Memories({ user, isArabic = false }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [notice, setNotice] = useState("");
  const ar = isArabic;

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data, error } = await supabase.from("stories").select("id,media_url,caption,audience,created_at,expires_at")
      .eq("user_id", user.id).lt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false }).limit(100);
    if (error) setNotice(error.message);
    else setItems(data || []);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { void load(); }, [load]);

  async function reshare(story) {
    setBusyId(story.id); setNotice("");
    const { error } = await supabase.from("stories").insert({
      user_id: user.id, media_url: story.media_url,
      caption: story.caption || "", audience: story.audience || "everyone",
    });
    if (error) setNotice(error.message);
    else setNotice(ar ? "تمت إعادة نشر الذكرى كقصة جديدة." : "Memory shared as a new story.");
    setBusyId("");
  }

  return <section className="lolz-memories-page">
    <header className="lolz-memories-header">
      <div><span className="eyebrow">LOLZ · ARCHIVE</span><h1>{ar ? "ذكرياتك" : "Your memories"}</h1>
        <p>{ar ? "قصصك السابقة التي انتهت مدتها، محفوظة هنا لتعود إليها." : "Your expired stories stay here so you can revisit and share them again."}</p></div>
      <button type="button" className="secondary-button" onClick={() => void load()}><RefreshCw size={16} />{ar ? "تحديث" : "Refresh"}</button>
    </header>
    {loading ? <p>{ar ? "جارٍ تحميل الذكريات…" : "Loading memories…"}</p> : items.length === 0 ? <div className="empty-state"><Archive size={28}/><h3>{ar ? "لا توجد ذكريات بعد" : "No memories yet"}</h3></div> :
      <div className="lolz-memories-grid">{items.map((item) => <article key={item.id} className="lolz-memory-card">
        {item.media_url?.match(/\.(mp4|webm|mov)(\?|$)/i) ? <video src={item.media_url} controls preload="metadata" /> : <img src={item.media_url} alt={item.caption || "LOLZ memory"} loading="lazy" />}
        <div><time>{new Date(item.created_at).toLocaleDateString(ar ? "ar" : undefined)}</time>
          {item.caption && <p>{item.caption}</p>}
          <button type="button" className="primary-button" disabled={busyId === item.id} onClick={() => void reshare(item)}><RefreshCw size={15}/>{ar ? "إعادة النشر كقصة" : "Share as story"}</button>
        </div>
      </article>)}</div>}
    {notice && <p role="status">{notice}</p>}
  </section>;
}
