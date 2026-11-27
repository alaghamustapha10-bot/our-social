import { useEffect, useState } from "react";
import { Bell, Clock3, LoaderCircle } from "lucide-react";
import { supabase } from "./supabase";

const defaults = {
  likes_enabled: true,
  comments_enabled: true,
  follows_enabled: true,
  messages_enabled: true,
  community_enabled: true,
  calls_enabled: true,
  quiet_hours_enabled: false,
  quiet_hours_start: "22:00",
  quiet_hours_end: "08:00",
  timezone: "Europe/Amsterdam",
};

export default function NotificationPreferences({ user, isArabic = false }) {
  const [settings, setSettings] = useState(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  const copy = isArabic ? {
    title: "إعدادات إشعارات الهاتف",
    description: "اختر أنواع التنبيهات التي تريد وصولها إلى جهازك. ستبقى الإشعارات داخل التطبيق محفوظة في مركز الإشعارات.",
    likes: "الإعجابات",
    comments: "التعليقات والردود على القصص",
    follows: "المتابعون الجدد",
    messages: "الرسائل الخاصة",
    community: "المجموعات والقنوات",
    calls: "المكالمات الواردة والفائتة",
    quiet: "تفعيل ساعات الهدوء",
    quietDesc: "كتم التنبيهات العادية خلال هذه الفترة. المكالمات الواردة تبقى مسموحة عند تفعيل إشعارات المكالمات.",
    from: "من",
    to: "إلى",
    save: "حفظ الإعدادات",
    saved: "تم حفظ إعدادات الإشعارات.",
    error: "تعذر حفظ الإعدادات: ",
    loading: "جارٍ تحميل الإعدادات…",
    pushOnly: "هذه الخيارات تتحكم بإشعارات الهاتف (Push)، ولا تحذف إشعارات مركز LOLZ.",
  } : {
    title: "Push notification settings",
    description: "Choose which alerts may reach your device. In-app notifications remain available in the notification center.",
    likes: "Likes",
    comments: "Comments and story replies",
    follows: "New followers",
    messages: "Private messages",
    community: "Groups and channels",
    calls: "Incoming and missed calls",
    quiet: "Enable quiet hours",
    quietDesc: "Mute routine alerts during this period. Incoming calls still come through when call notifications are enabled.",
    from: "From",
    to: "To",
    save: "Save settings",
    saved: "Notification settings saved.",
    error: "Could not save settings: ",
    loading: "Loading settings…",
    pushOnly: "These options control device push alerts only; they do not remove items from your LOLZ notification inbox.",
  };

  useEffect(() => {
    let active = true;
    async function load() {
      if (!user?.id) return;
      setLoading(true);
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || defaults.timezone;
      const { data, error } = await supabase
        .from("lolz_notification_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!active) return;
      if (error) {
        setNotice(error.message);
      } else {
        setSettings((current) => ({
          ...current,
          timezone,
          ...(data || {}),
          quiet_hours_start: String(data?.quiet_hours_start || current.quiet_hours_start).slice(0, 5),
          quiet_hours_end: String(data?.quiet_hours_end || current.quiet_hours_end).slice(0, 5),
        }));
      }
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [user?.id]);

  function toggle(key) {
    setSettings((current) => ({ ...current, [key]: !current[key] }));
  }

  async function save() {
    if (!user?.id) return;
    setSaving(true);
    setNotice("");
    const payload = {
      ...settings,
      user_id: user.id,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from("lolz_notification_preferences")
      .upsert(payload, { onConflict: "user_id" });
    setSaving(false);
    if (error) setNotice(copy.error + error.message);
    else setNotice(copy.saved);
  }

  const rows = [
    ["likes_enabled", copy.likes],
    ["comments_enabled", copy.comments],
    ["follows_enabled", copy.follows],
    ["messages_enabled", copy.messages],
    ["community_enabled", copy.community],
    ["calls_enabled", copy.calls],
  ];

  return (
    <section className="lolz-notification-preferences" dir={isArabic ? "rtl" : "ltr"}>
      <div className="lolz-notification-preferences-heading">
        <span className="lolz-notification-preferences-icon"><Bell size={19} /></span>
        <div>
          <h2>{copy.title}</h2>
          <p>{copy.description}</p>
        </div>
      </div>

      {loading ? <p>{copy.loading}</p> : (
        <>
          <div className="lolz-notification-preferences-grid">
            {rows.map(([key, label]) => (
              <label className="lolz-notification-toggle" key={key}>
                <span>{label}</span>
                <input type="checkbox" checked={Boolean(settings[key])} onChange={() => toggle(key)} />
              </label>
            ))}
          </div>

          <div className="lolz-quiet-hours">
            <label className="lolz-notification-toggle">
              <span><Clock3 size={16} /> {copy.quiet}</span>
              <input type="checkbox" checked={Boolean(settings.quiet_hours_enabled)} onChange={() => toggle("quiet_hours_enabled")} />
            </label>
            <p>{copy.quietDesc}</p>
            {settings.quiet_hours_enabled && (
              <div className="lolz-quiet-hours-times">
                <label>{copy.from}<input type="time" value={settings.quiet_hours_start} onChange={(event) => setSettings((current) => ({ ...current, quiet_hours_start: event.target.value }))} /></label>
                <label>{copy.to}<input type="time" value={settings.quiet_hours_end} onChange={(event) => setSettings((current) => ({ ...current, quiet_hours_end: event.target.value }))} /></label>
              </div>
            )}
            <small>{settings.timezone}</small>
          </div>

          <div className="lolz-notification-preferences-footer">
            <p>{copy.pushOnly}</p>
            <button type="button" onClick={save} disabled={saving}>
              {saving ? <LoaderCircle size={16} className="lolz-spin" /> : null}
              {copy.save}
            </button>
          </div>
        </>
      )}
      {notice && <p className="lolz-notification-preferences-notice" role="status">{notice}</p>}
    </section>
  );
}
