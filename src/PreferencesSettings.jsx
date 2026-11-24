import { useState } from "react";
import { usePreferences } from "./PreferencesProvider";

export default function PreferencesSettings() {
  const {
    preferences,
    updatePreferences,
    loadingPreferences,
  } = usePreferences();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isArabic = preferences.language === "ar";

  const translations = {
    title: isArabic ? "المظهر واللغة" : "Appearance & Language",
    theme: isArabic ? "المظهر" : "Theme",
    dark: isArabic ? "داكن" : "Dark",
    light: isArabic ? "فاتح" : "Light",
    language: isArabic ? "اللغة" : "Language",
    english: "English",
    arabic: "العربية",

    backgroundTitle: isArabic
      ? "استمرار المكالمات في الخلفية"
      : "Background Calls",

    backgroundDescription: isArabic
      ? "عند تفعيل هذا الخيار، يسمح التطبيق باستمرار المكالمات عند تصغيره أو الانتقال إلى تطبيق آخر. يتطلب ذلك دعم Android المناسب، وقد يخضع لقيود النظام."
      : "When enabled, the app is configured to keep calls running when minimized or when you switch to another app. This requires Android background-service support and remains subject to system restrictions.",

    enabled: isArabic ? "مفعّل" : "Enabled",
    disabled: isArabic ? "معطّل" : "Disabled",

    saving: isArabic ? "جارٍ الحفظ..." : "Saving...",
    loading: isArabic ? "جارٍ تحميل الإعدادات..." : "Loading settings...",
    error: isArabic ? "تعذر حفظ الإعدادات" : "Could not save settings",
  };

  async function changePreference(changes) {
    setSaving(true);
    setError("");

    try {
      await updatePreferences(changes);
    } catch (err) {
      console.error("Preference update error:", err);
      setError(translations.error);
    } finally {
      setSaving(false);
    }
  }

  const buttonStyle = (active) => ({
    padding: "12px 22px",
    borderRadius: "10px",
    border: active
      ? "2px solid var(--text)"
      : "1px solid var(--border)",
    background: active ? "var(--text)" : "var(--panel)",
    color: active ? "var(--bg)" : "var(--text)",
    cursor: "pointer",
    fontWeight: 600,
    transition: "all 0.2s ease",
  });

  const backgroundEnabled =
    preferences.backgroundCallsEnabled === true;

  return (
    <section
      style={{
        maxWidth: "650px",
        padding: "24px",
        margin: "0 auto",
        color: "var(--text)",
      }}
      dir={isArabic ? "rtl" : "ltr"}
    >
      <h2>{translations.title}</h2>

      {loadingPreferences ? (
        <p>{translations.loading}</p>
      ) : (
        <>
          {/* THEME */}

          <div style={{ marginTop: "30px" }}>
            <h3>{translations.theme}</h3>

            <div
              style={{
                display: "flex",
                gap: "12px",
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                style={buttonStyle(preferences.theme === "dark")}
                onClick={() => changePreference({ theme: "dark" })}
                disabled={saving}
              >
                🌙 {translations.dark}
              </button>

              <button
                type="button"
                style={buttonStyle(preferences.theme === "light")}
                onClick={() => changePreference({ theme: "light" })}
                disabled={saving}
              >
                ☀️ {translations.light}
              </button>
            </div>
          </div>

          {/* LANGUAGE */}

          <div style={{ marginTop: "30px" }}>
            <h3>{translations.language}</h3>

            <div
              style={{
                display: "flex",
                gap: "12px",
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                style={buttonStyle(preferences.language === "en")}
                onClick={() => changePreference({ language: "en" })}
                disabled={saving}
              >
                {translations.english}
              </button>

              <button
                type="button"
                style={buttonStyle(preferences.language === "ar")}
                onClick={() => changePreference({ language: "ar" })}
                disabled={saving}
              >
                {translations.arabic}
              </button>
            </div>
          </div>

          {/* BACKGROUND CALLS */}

          <div
            style={{
              marginTop: "30px",
              padding: "18px",
              border: "1px solid var(--border)",
              borderRadius: "14px",
              background: "var(--panel)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "16px",
              }}
            >
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: "0 0 8px" }}>
                  {translations.backgroundTitle}
                </h3>

                <p
                  style={{
                    margin: 0,
                    color: "var(--text)",
                    opacity: 0.75,
                    fontSize: "13px",
                    lineHeight: 1.7,
                  }}
                >
                  {translations.backgroundDescription}
                </p>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={backgroundEnabled}
                aria-label={translations.backgroundTitle}
                disabled={saving}
                onClick={() =>
                  changePreference({
                    backgroundCallsEnabled: !backgroundEnabled,
                  })
                }
                style={{
                  width: "60px",
                  minWidth: "60px",
                  height: "32px",
                  padding: "3px",
                  border: "none",
                  borderRadius: "20px",
                  background: backgroundEnabled
                    ? "#20a56b"
                    : "#737986",
                  cursor: saving ? "not-allowed" : "pointer",
                  opacity: saving ? 0.6 : 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: backgroundEnabled
                    ? "flex-start"
                    : "flex-end",
                  transition: "background 0.2s ease",
                }}
              >
                <span
                  style={{
                    width: "26px",
                    height: "26px",
                    borderRadius: "50%",
                    background: "#ffffff",
                    display: "block",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
                  }}
                />
              </button>
            </div>

            <div
              style={{
                marginTop: "12px",
                fontSize: "12px",
                fontWeight: 600,
                color: backgroundEnabled ? "#20a56b" : "var(--text)",
                opacity: backgroundEnabled ? 1 : 0.65,
              }}
            >
              {backgroundEnabled
                ? translations.enabled
                : translations.disabled}
            </div>
          </div>
        </>
      )}

      {saving && (
        <p style={{ marginTop: "20px" }}>
          {translations.saving}
        </p>
      )}

      {error && (
        <p style={{ color: "#d33", marginTop: "20px" }}>
          {error}
        </p>
      )}
    </section>
  );
}
