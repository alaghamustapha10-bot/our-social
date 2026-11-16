
export const DEFAULT_PREFERENCES = {
  theme: "dark",
  language: "en",
};

export function normalizePreferences(preferences) {
  const normalized = {
    ...DEFAULT_PREFERENCES,
    ...(preferences || {}),
  };

  return {
    theme: normalized.theme === "light" ? "light" : "dark",
    language: normalized.language === "ar" ? "ar" : "en",
  };
}
