import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";
import { CalendarDays, ChartNoAxesColumn, Plus, Vote } from "lucide-react";

export default function GroupActivities({ groupId, user, onModerate }) {
  const ar = typeof document !== "undefined" && document.documentElement.lang === "ar";
  const [polls, setPolls] = useState([]);
  const [events, setEvents] = useState([]);
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState("");
  const [eventTitle, setEventTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [showPollForm, setShowPollForm] = useState(false);
  const [showEventForm, setShowEventForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    if (!groupId) return;
    const { data: pollRows, error: pollError } = await supabase.from("lolz_group_polls").select("*").eq("group_id", String(groupId)).order("created_at", { ascending: false }).limit(10);
    if (pollError) { setNotice(pollError.message); return; }
    const ids = (pollRows || []).map((poll) => poll.id);
    let votes = [];
    if (ids.length) {
      const result = await supabase.from("lolz_group_poll_votes").select("poll_id,voter_id,option_index").in("poll_id", ids);
      if (!result.error) votes = result.data || [];
    }
    const enriched = (pollRows || []).map((poll) => ({
      ...poll,
      votes: votes.filter((vote) => vote.poll_id === poll.id),
      myVote: votes.find((vote) => vote.poll_id === poll.id && vote.voter_id === user?.id),
    }));
    const { data: eventRows, error: eventError } = await supabase.from("lolz_group_events").select("*").eq("group_id", String(groupId)).order("starts_at", { ascending: true }).limit(10);
    if (eventError) setNotice(eventError.message);
    setPolls(enriched);
    setEvents(eventRows || []);
  }, [groupId, user?.id]);

  useEffect(() => { void load(); }, [load]);

  async function createPoll(event) {
    event.preventDefault();
    const cleanOptions = options.split(",").map((item) => item.trim()).filter(Boolean).slice(0, 8);
    if (cleanOptions.length < 2 || !question.trim()) {
      setNotice(ar ? "أدخل سؤالاً وخيارين على الأقل." : "Enter a question and at least two options.");
      return;
    }
    if (onModerate && !(await onModerate([question.trim(), ...cleanOptions].join("\n"), null))) return;
    setBusy(true); setNotice("");
    const { error } = await supabase.from("lolz_group_polls").insert({
      group_id: String(groupId), created_by: user.id, question: question.trim(), options: cleanOptions,
    });
    if (error) setNotice(error.message);
    else { setQuestion(""); setOptions(""); setShowPollForm(false); await load(); }
    setBusy(false);
  }

  async function vote(poll, optionIndex) {
    if (poll.myVote || (poll.ends_at && new Date(poll.ends_at) <= new Date())) return;
    setBusy(true);
    const { error } = await supabase.from("lolz_group_poll_votes").insert({
      poll_id: poll.id, voter_id: user.id, option_index: optionIndex,
    });
    if (error) setNotice(error.message);
    await load();
    setBusy(false);
  }

  async function createEvent(event) {
    event.preventDefault();
    if (!eventTitle.trim() || !eventDate) return;
    if (onModerate && !(await onModerate([eventTitle.trim(), eventDescription.trim()].join("\n"), null))) return;
    setBusy(true); setNotice("");
    const { error } = await supabase.from("lolz_group_events").insert({
      group_id: String(groupId), created_by: user.id, title: eventTitle.trim(),
      description: eventDescription.trim() || null, starts_at: new Date(eventDate).toISOString(),
    });
    if (error) setNotice(error.message);
    else { setEventTitle(""); setEventDate(""); setEventDescription(""); setShowEventForm(false); await load(); }
    setBusy(false);
  }

  const panel = { border: "1px solid var(--border)", background: "var(--panel)", borderRadius: 13, padding: 13, margin: "10px 0", color: "var(--text)" };
  const button = { display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid var(--border)", borderRadius: 9, padding: "7px 10px", background: "var(--panel-2)", color: "var(--text)", cursor: "pointer" };
  const field = { width: "100%", boxSizing: "border-box", padding: 10, borderRadius: 9, border: "1px solid var(--border)", background: "var(--panel-2)", color: "var(--text)", marginTop: 7 };

  return <section style={{ padding: "8px 18px", borderBottom: "1px solid var(--border)", color: "var(--text)" }}>
    <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
      <button style={button} onClick={() => { setShowPollForm((v) => !v); setShowEventForm(false); }}><ChartNoAxesColumn size={15} />{ar ? "استطلاع" : "Poll"}</button>
      <button style={button} onClick={() => { setShowEventForm((v) => !v); setShowPollForm(false); }}><CalendarDays size={15} />{ar ? "فعالية" : "Event"}</button>
      <button style={button} onClick={() => void load()}>{ar ? "تحديث" : "Refresh"}</button>
    </div>

    {showPollForm && <form onSubmit={createPoll} style={panel}>
      <strong>{ar ? "إنشاء استطلاع" : "Create a poll"}</strong>
      <input style={field} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={ar ? "ما السؤال؟" : "Ask a question"} maxLength={300} />
      <input style={field} value={options} onChange={(e) => setOptions(e.target.value)} placeholder={ar ? "الخيارات مفصولة بفواصل" : "Options separated by commas"} />
      <button style={{ ...button, marginTop: 9 }} disabled={busy} type="submit"><Plus size={14} />{ar ? "نشر الاستطلاع" : "Publish poll"}</button>
    </form>}

    {showEventForm && <form onSubmit={createEvent} style={panel}>
      <strong>{ar ? "إنشاء فعالية" : "Create an event"}</strong>
      <input style={field} value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} placeholder={ar ? "اسم الفعالية" : "Event title"} maxLength={160} />
      <input style={field} type="datetime-local" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
      <textarea style={field} value={eventDescription} onChange={(e) => setEventDescription(e.target.value)} placeholder={ar ? "التفاصيل (اختياري)" : "Details (optional)"} maxLength={2000} />
      <button style={{ ...button, marginTop: 9 }} disabled={busy} type="submit"><Plus size={14} />{ar ? "نشر الفعالية" : "Publish event"}</button>
    </form>}

    {(polls.length > 0 || events.length > 0) && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 10, marginTop: 10 }}>
      {polls.map((poll) => <article key={poll.id} style={panel}>
        <strong><Vote size={15} style={{ verticalAlign: "middle" }} /> {poll.question}</strong>
        {(poll.options || []).map((option, index) => {
          const count = poll.votes.filter((vote) => vote.option_index === index).length;
          const total = poll.votes.length;
          const selected = poll.myVote?.option_index === index;
          return <button key={index} disabled={busy || Boolean(poll.myVote)} onClick={() => void vote(poll, index)} style={{ ...button, display: "flex", width: "100%", justifyContent: "space-between", marginTop: 7, borderColor: selected ? "var(--accent)" : "var(--border)" }}>
            <span>{option}</span><small>{count}{total ? ` · ${Math.round(count / total * 100)}%` : ""}</small>
          </button>;
        })}
        <small style={{ color: "var(--muted)" }}>{poll.votes.length} {ar ? "أصوات" : "votes"}</small>
      </article>)}
      {events.map((item) => <article key={item.id} style={panel}>
        <strong><CalendarDays size={15} style={{ verticalAlign: "middle" }} /> {item.title}</strong>
        <p style={{ margin: "7px 0", color: "var(--muted)" }}>{item.description}</p>
        <time>{new Date(item.starts_at).toLocaleString(ar ? "ar" : undefined)}</time>
      </article>)}
    </div>}
    {notice && <p role="status" style={{ color: "#f87171", fontSize: 13 }}>{notice}</p>}
  </section>;
}
