
import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import { supabase } from "./supabase";

import {
  DEFAULT_PREFERENCES,
  normalizePreferences,
} from "./preferences";

const PreferencesContext = createContext(null);

export function PreferencesProvider({ children, userId }) {
  const [preferences, setPreferences] = useState(
    DEFAULT_PREFERENCES
  );

  const [loadingPreferences, setLoadingPreferences] =
    useState(true);

  useEffect(() => {
    if (!userId) {
      setPreferences(DEFAULT_PREFERENCES);
      setLoadingPreferences(false);
      return;
    }

    let active = true;

    async function loadPreferences() {
      const { data, error } = await supabase
        .from("profiles")
        .select("preferences")
        .eq("id", userId)
        .single();

      if (!active) return;

      if (error) {
        console.error("Could not load preferences:", error);
      } else {
        setPreferences(
          normalizePreferences(data?.preferences)
        );
      }

      setLoadingPreferences(false);
    }

    setLoadingPreferences(true);
    loadPreferences();

    return () => {
      active = false;
    };
  }, [userId]);

  async function updatePreferences(changes) {
    const next = normalizePreferences({
      ...preferences,
      ...changes,
    });

    const previous = preferences;

    setPreferences(next);

    if (!userId) return;

    const { error } = await supabase
      .from("profiles")
      .update({ preferences: next })
      .eq("id", userId);

    if (error) {
      setPreferences(previous);
      console.error("Could not save preferences:", error);
      throw error;
    }
  }

  useEffect(() => {
    const root = document.documentElement;

    root.dataset.theme = preferences.theme;
    root.lang = preferences.language;
    root.dir = preferences.language === "ar" ? "rtl" : "ltr";
  }, [preferences]);

  return (
    <PreferencesContext.Provider
      value={{
        preferences,
        updatePreferences,
        loadingPreferences,
      }}
    >
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const context = useContext(PreferencesContext);

  if (!context) {
    throw new Error(
      "usePreferences must be used inside PreferencesProvider"
    );
  }

  return context;
}
