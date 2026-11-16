
import { useState } from "react";
import { usePreferences } from "./PreferencesProvider";

export default function PreferencesSettings() {
  const { preferences, updatePreferences } = usePreferences();

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
    saving: isArabic ? "جارٍ الحفظ..." : "Saving...",
    error: isArabic ? "تعذر حفظ الإعدادات" : "Could not save settings",
  };

  async function changePreference(changes) {
    setSaving(true);
    setError("");

    try {
      await updatePreferences(changes);
    } catch {
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

      <div style={{ marginTop: "30px" }}>
        <h3>{translations.theme}</h3>

        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <button
            style={buttonStyle(preferences.theme === "dark")}
            onClick={() => changePreference({ theme: "dark" })}
            disabled={saving}
          >
            🌙 {translations.dark}
          </button>

          <button
            style={buttonStyle(preferences.theme === "light")}
            onClick={() => changePreference({ theme: "light" })}
            disabled={saving}
          >
            ☀️ {translations.light}
          </button>
        </div>
      </div>

      <div style={{ marginTop: "30px" }}>
        <h3>{translations.language}</h3>

        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <button
            style={buttonStyle(preferences.language === "en")}
            onClick={() => changePreference({ language: "en" })}
            disabled={saving}
          >
            {translations.english}
          </button>

          <button
            style={buttonStyle(preferences.language === "ar")}
            onClick={() => changePreference({ language: "ar" })}
            disabled={saving}
          >
            {translations.arabic}
          </button>
        </div>
      </div>

      {saving && <p style={{ marginTop: "20px" }}>{translations.saving}</p>}

      {error && (
        <p style={{ color: "#d33", marginTop: "20px" }}>
          {error}
        </p>
      )}
    </section>
  );
}
