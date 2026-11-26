export const SUPPORTED_LANGUAGES = ["ar","en","nl","de","fr","es","tr","ru","it","pt","ur","hi"];

export const DEFAULT_PREFERENCES = {
  theme: "dark",
  language: "en",
  backgroundCallsEnabled: false,
  accentColor: "#8b5cf6",
  fontScale: "normal",
  reduceMotion: false,
  notifyLikes: true,
  notifyMessages: true,
  notifyCalls: true,
};

export function normalizePreferences(preferences) {
  const value = { ...DEFAULT_PREFERENCES, ...(preferences || {}) };
  return {
    ...DEFAULT_PREFERENCES,
    ...value,
    theme: value.theme === "light" ? "light" : "dark",
    language: SUPPORTED_LANGUAGES.includes(value.language) ? value.language : "en",
    backgroundCallsEnabled: value.backgroundCallsEnabled === true,
    accentColor: /^#[0-9a-fA-F]{6}$/.test(value.accentColor || "") ? value.accentColor : DEFAULT_PREFERENCES.accentColor,
    fontScale: value.fontScale === "large" ? "large" : "normal",
    reduceMotion: value.reduceMotion === true,
    notifyLikes: value.notifyLikes !== false,
    notifyMessages: value.notifyMessages !== false,
    notifyCalls: value.notifyCalls !== false,
  };
}
