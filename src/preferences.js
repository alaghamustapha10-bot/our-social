export const DEFAULT_PREFERENCES = {
  theme: "dark",
  language: "en",
  backgroundCallsEnabled: false,
};

export function normalizePreferences(preferences) {
  const normalized = {
    ...DEFAULT_PREFERENCES,
    ...(preferences || {}),
  };

  return {
    theme: normalized.theme === "light" ? "light" : "dark",
    language: normalized.language === "ar" ? "ar" : "en",
    backgroundCallsEnabled:
      normalized.backgroundCallsEnabled === true,
  };
}
