import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";
import "./AccountCenter.css";
import { ShieldCheck, UserPlus, UserMinus, Search, LoaderCircle } from "lucide-react";

export default function AccountCenter({ user, isArabic = false }) {
  const [settings, setSettings] = useState({
    profile_visibility: "public",
    allow_messages_from: "everyone",
    allow_comments_from: "everyone",
    show_activity: true,
    show_last_seen: true,
  });
  const [friends, setFriends] = useState([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [notice, setNotice] = useState("");
  const [factors, setFactors] = useState([]);
  const [mfaLoading, setMfaLoading] = useState(false);
  const [enrollment, setEnrollment] = useState(null);
  const [otp, setOtp] = useState("");
  const [factorBusy, setFactorBusy] = useState(false);

  const copy = isArabic ? {
    title: "مركز الحساب والخصوصية",
    desc: "تحكم بمن يرى حسابك ومن يستطيع التواصل معك.",
    privacy: "الخصوصية",
    public: "عام",
    private: "خاص",
    messages: "من يستطيع مراسلتك؟",
    comments: "من يستطيع التعليق؟",
    everyone: "الجميع",
    following: "الأشخاص الذين تتابعهم",
    nobody: "لا أحد",
    activity: "إظهار حالة النشاط",
    lastSeen: "إظهار آخر ظهور",
    friends: "الأصدقاء المقرّبون",
    friendsDesc: "هؤلاء فقط يستطيعون مشاهدة القصص التي تنشرها للأصدقاء المقرّبين.",
    search: "ابحث عن اسم أو اسم مستخدم",
    add: "إضافة",
    remove: "إزالة",
    noFriends: "لم تضف أصدقاء مقرّبين بعد.",
    security: "أمان الحساب",
    mfa: "التحقق بخطوتين",
    mfaDesc: "اربط تطبيق مصادقة مثل Google Authenticator أو Microsoft Authenticator.",
    enable: "إعداد تطبيق المصادقة",
    verify: "تحقق وفعّل",
    code: "رمز التحقق المكوّن من 6 أرقام",
    enabled: "مفعّل",
    disable: "إلغاء التحقق بخطوتين",
    loading: "جارٍ التحميل…",
    save: "حفظ الإعدادات",
    saved: "تم حفظ الإعدادات.",
    failed: "تعذّر حفظ الإعدادات: ",
    mfaError: "تعذّر إعداد التحقق: ",
    enterCode: "أدخل الرمز من تطبيق المصادقة.",
    ready: "امسح رمز QR ثم أدخل الرمز الحالي.",
  } : {
    title: "Account & privacy center",
    desc: "Choose who can see your profile and contact you.",
    privacy: "Privacy",
    public: "Public",
    private: "Private",
    messages: "Who can message you?",
    comments: "Who can comment?",
    everyone: "Everyone",
    following: "People you follow",
    nobody: "Nobody",
    activity: "Show activity status",
    lastSeen: "Show last seen",
    friends: "Close friends",
    friendsDesc: "Only these people can see stories you share with your close-friends audience.",
    search: "Search by name or username",
    add: "Add",
    remove: "Remove",
    noFriends: "You have not added close friends yet.",
    security: "Account security",
    mfa: "Two-factor authentication",
    mfaDesc: "Connect an authenticator app such as Google Authenticator or Microsoft Authenticator.",
    enable: "Set up authenticator app",
    verify: "Verify and enable",
    code: "6-digit verification code",
    enabled: "Enabled",
    disable: "Turn off two-factor authentication",
    loading: "Loading…",
    save: "Save settings",
    saved: "Settings saved.",
    failed: "Could not save settings: ",
    mfaError: "Could not configure authentication: ",
    enterCode: "Enter the code from your authenticator app.",
    ready: "Scan the QR code, then enter the current code.",
  };

  const panel = { background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 18, padding: 18, marginTop: 16 };
  const button = { border: "1px solid var(--border)", borderRadius: 10, padding: "9px 13px", background: "var(--panel-2)", color: "var(--text)", cursor: "pointer", fontWeight: 650 };
  const selectStyle = { ...button, minWidth: 190 };

  const loadFriends = useCallback(async () => {
    if (!user?.id) return;
    const { data: rows, error } = await supabase.from("lolz_close_friends").select("friend_id").eq("owner_id", user.id);
    if (error) throw error;
    const ids = (rows || []).map((row) => row.friend_id);
    if (!ids.length) { setFriends([]); return; }
    const { data, error: profileError } = await supabase.from("profiles").select("id,username,display_name,avatar_url").in("id", ids);
    if (profileError) throw profileError;
    setFriends(data || []);
  }, [user?.id]);

  const loadMfa = useCallback(async () => {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) throw error;
    setFactors((data?.totp || []).filter((factor) => factor.status === "verified"));
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!user?.id) return;
      setLoading(true);
      try {
        const [settingsResult] = await Promise.all([
          supabase.from("lolz_account_settings").select("*").eq("user_id", user.id).maybeSingle(),
          loadFriends(),
          loadMfa(),
        ]);
        if (settingsResult.error) throw settingsResult.error;
        if (active && settingsResult.data) setSettings((current) => ({ ...current, ...settingsResult.data }));
      } catch (error) {
        if (active) setNotice(error.message || String(error));
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [user?.id, loadFriends, loadMfa]);

  async function saveSettings() {
    setSaving(true); setNotice("");
    const payload = { ...settings, user_id: user.id, updated_at: new Date().toISOString() };
    const { error } = await supabase.from("lolz_account_settings").upsert(payload, { onConflict: "user_id" });
    setSaving(false);
    setNotice(error ? copy.failed + error.message : copy.saved);
  }

  async function searchPeople(value) {
    setQuery(value);
    const term = value.trim().replace(/[,%()]/g, " ");
    if (term.length < 2) { setResults([]); return; }
    const { data, error } = await supabase.from("profiles")
      .select("id,username,display_name,avatar_url")
      .neq("id", user.id)
      .or(`username.ilike.%${term}%,display_name.ilike.%${term}%`)
      .limit(12);
    if (error) setNotice(error.message);
    else setResults((data || []).filter((person) => !friends.some((friend) => friend.id === person.id)));
  }

  async function addFriend(person) {
    setBusyId(person.id); setNotice("");
    const { error } = await supabase.from("lolz_close_friends").insert({ owner_id: user.id, friend_id: person.id });
    if (error) setNotice(error.message);
    else { await loadFriends(); setResults((items) => items.filter((item) => item.id !== person.id)); }
    setBusyId("");
  }

  async function removeFriend(person) {
    setBusyId(person.id);
    const { error } = await supabase.from("lolz_close_friends").delete().eq("owner_id", user.id).eq("friend_id", person.id);
    if (error) setNotice(error.message);
    else setFriends((items) => items.filter((item) => item.id !== person.id));
    setBusyId("");
  }

  async function startMfa() {
    setFactorBusy(true); setNotice("");
    try {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "LOLZ authenticator" });
      if (error) throw error;
      setEnrollment(data);
      setNotice(copy.ready);
    } catch (error) { setNotice(copy.mfaError + error.message); }
    finally { setFactorBusy(false); }
  }

  async function verifyMfa() {
    if (!enrollment?.id || !/^\d{6}$/.test(otp.trim())) { setNotice(copy.enterCode); return; }
    setFactorBusy(true); setNotice("");
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: enrollment.id, code: otp.trim() });
      if (error) throw error;
      setEnrollment(null); setOtp(""); await loadMfa(); setNotice(copy.enabled);
    } catch (error) { setNotice(copy.mfaError + error.message); }
    finally { setFactorBusy(false); }
  }

  async function disableMfa(factorId) {
    setFactorBusy(true); setNotice("");
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) setNotice(error.message);
    else { await loadMfa(); setNotice(""); }
    setFactorBusy(false);
  }

  const field = (label, key, values) => (
    <label style={{ display: "flex", flexDirection: "column", gap: 7, minWidth: 210, flex: 1 }}>
      <span style={{ fontWeight: 650 }}>{label}</span>
      <select style={selectStyle} value={settings[key]} onChange={(event) => setSettings((current) => ({ ...current, [key]: event.target.value }))}>
        {values.map(([value, name]) => <option key={value} value={value}>{name}</option>)}
      </select>
    </label>
  );

  if (loading) return <section style={panel}>{copy.loading}</section>;

  return <section className="lolz-account-center" dir={isArabic ? "rtl" : "ltr"} style={{ maxWidth: 820, margin: "18px auto", color: "var(--text)" }}>
    <header style={{ ...panel, marginTop: 0, background: "linear-gradient(130deg,rgba(139,92,246,.2),rgba(59,130,246,.08))" }}>
      <div style={{ color: "#a78bfa", fontSize: 12, fontWeight: 800, letterSpacing: 1.4 }}>LOLZ · CONTROL CENTER</div>
      <h2 style={{ margin: "9px 0 5px" }}>{copy.title}</h2><p style={{ margin: 0, color: "var(--muted)" }}>{copy.desc}</p>
    </header>

    <section style={panel}>
      <h3 style={{ marginTop: 0 }}>🔐 {copy.privacy}</h3>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
        {field(copy.privacy, "profile_visibility", [["public", copy.public], ["private", copy.private]])}
        {field(copy.messages, "allow_messages_from", [["everyone", copy.everyone], ["following", copy.following], ["nobody", copy.nobody]])}
        {field(copy.comments, "allow_comments_from", [["everyone", copy.everyone], ["following", copy.following], ["nobody", copy.nobody]])}
      </div>
      {[["show_activity", copy.activity], ["show_last_seen", copy.lastSeen]].map(([key, label]) => <label key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 0", borderTop: "1px solid var(--border)", marginTop: 12, gap: 12 }}>
        <span>{label}</span><input type="checkbox" checked={settings[key]} onChange={(event) => setSettings((current) => ({ ...current, [key]: event.target.checked }))} />
      </label>)}
      <button style={{ ...button, marginTop: 12, background: "var(--accent)", color: "#fff" }} onClick={saveSettings} disabled={saving}>{saving ? <LoaderCircle size={15} /> : null}{copy.save}</button>
    </section>

    <section style={panel}>
      <h3 style={{ marginTop: 0 }}>💚 {copy.friends}</h3>
      <p style={{ color: "var(--muted)", marginTop: -4 }}>{copy.friendsDesc}</p>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <input style={{ ...button, flex: 1, textAlign: "start" }} value={query} onChange={(event) => void searchPeople(event.target.value)} placeholder={copy.search} />
        <Search size={18} />
      </div>
      {results.map((person) => <div key={person.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "9px 0", borderBottom: "1px solid var(--border)" }}>
        <span>{person.display_name || person.username || "LOLZ member"} @{person.username || ""}</span>
        <button style={button} disabled={busyId === person.id} onClick={() => void addFriend(person)}><UserPlus size={15} /> {copy.add}</button>
      </div>)}
      {friends.length === 0 ? <p style={{ color: "var(--muted)" }}>{copy.noFriends}</p> : friends.map((person) => <div key={person.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "9px 0", borderBottom: "1px solid var(--border)" }}>
        <span>{person.display_name || person.username || "LOLZ member"} @{person.username || ""}</span>
        <button style={button} disabled={busyId === person.id} onClick={() => void removeFriend(person)}><UserMinus size={15} /> {copy.remove}</button>
      </div>)}
    </section>

    <section style={panel}>
      <h3 style={{ marginTop: 0 }}>🛡️ {copy.security}</h3>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}><ShieldCheck color="#8b5cf6" /><strong>{copy.mfa}</strong></div>
      <p style={{ color: "var(--muted)" }}>{copy.mfaDesc}</p>
      {factors.length > 0 ? factors.map((factor) => <div key={factor.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <span>✓ {copy.enabled}</span><button style={button} disabled={factorBusy} onClick={() => void disableMfa(factor.id)}>{copy.disable}</button>
      </div>) : !enrollment ? <button style={button} disabled={factorBusy} onClick={() => void startMfa()}>{copy.enable}</button> : <div style={{ display: "grid", gap: 12 }}>
        {enrollment.totp?.qr_code && <img alt="Authenticator QR code" src={enrollment.totp.qr_code} style={{ width: 190, maxWidth: "100%", background: "#fff", padding: 10, borderRadius: 12 }} />}
        {enrollment.totp?.secret && <code style={{ overflowWrap: "anywhere" }}>{enrollment.totp.secret}</code>}
        <input value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder={copy.code} style={button} />
        <button style={button} disabled={factorBusy} onClick={() => void verifyMfa()}>{copy.verify}</button>
      </div>}
    </section>
    {notice && <p role="status" style={{ ...panel, color: "var(--text)" }}>{notice}</p>}
  </section>;
}
