import { useEffect, useRef, useState } from "react";
import { App as CapacitorApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";

import { supabase } from "./supabase";
import Auth from "./Auth";
import { PreferencesProvider } from "./PreferencesProvider";
import { NATIVE_AUTH_CALLBACK_URL } from "./authRedirect";

function isTemporaryUsername(username) {
  return /^user_[0-9a-f]{8}$/i.test(username || "");
}

function getLanguage() {
  try {
    return localStorage.getItem("lolz-language") === "ar"
      ? "ar"
      : "en";
  } catch {
    return "en";
  }
}

export default function AuthGate({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  const [profile, setProfile] = useState(null);
  const [profileStatus, setProfileStatus] = useState("idle");

  const [username, setUsername] = useState("");
  const [savingUsername, setSavingUsername] = useState(false);
  const [usernameError, setUsernameError] = useState("");
  const [authError, setAuthError] = useState("");

  const processedUrls = useRef(new Set());

  const language = getLanguage();
  const isArabic = language === "ar";

  const translations = {
    en: {
      loading: "Loading LOLZ...",
      title: "Choose your username",
      description:
        "Welcome to LOLZ! Choose a unique username to complete your account.",
      username: "Username",
      placeholder: "Choose a username",
      hint:
        "3–30 characters. Use English letters, numbers, and underscores.",
      save: "Continue",
      saving: "Saving...",
      logout: "Sign out",
      invalid:
        "Use 3–30 characters: English letters, numbers, and underscores.",
      temporary: "Please choose a different username.",
      taken: "This username is already taken. Try another one.",
      failed: "Could not save your username. Please try again.",
      profileFailed: "Could not load your profile.",
      retry: "Try again",
      callbackFailed:
        "Google sign-in could not be completed. Please try again.",
    },

    ar: {
      loading: "جارٍ تحميل لولز...",
      title: "اختر اسم المستخدم",
      description:
        "مرحبًا بك في لولز! اختر اسم مستخدم فريدًا لإكمال حسابك.",
      username: "اسم المستخدم",
      placeholder: "اختر اسم مستخدم",
      hint:
        "من 3 إلى 30 حرفًا. استخدم الحروف الإنجليزية والأرقام والشرطة السفلية.",
      save: "متابعة",
      saving: "جارٍ الحفظ...",
      logout: "تسجيل الخروج",
      invalid:
        "استخدم من 3 إلى 30 حرفًا إنجليزيًا أو رقمًا أو شرطة سفلية.",
      temporary: "يرجى اختيار اسم مستخدم مختلف.",
      taken: "اسم المستخدم مستخدم بالفعل. جرّب اسمًا آخر.",
      failed: "تعذر حفظ اسم المستخدم. حاول مرة أخرى.",
      profileFailed: "تعذر تحميل ملفك الشخصي.",
      retry: "إعادة المحاولة",
      callbackFailed:
        "تعذر إكمال تسجيل الدخول. حاول مرة أخرى.",
    },
  };

  const t = translations[language];

  // Handle Supabase PKCE callbacks from Google OAuth and confirmed signups.
  useEffect(() => {
    let mounted = true;
    let appUrlListener = null;

    async function handleCallbackUrl(url) {
      let callbackUrl;

      try {
        callbackUrl = new URL(url);
      } catch {
        return;
      }

      if (
        callbackUrl.protocol !== "com.oursocial.app:" ||
        callbackUrl.hostname !== "login-callback"
      ) {
        return;
      }

      if (processedUrls.current.has(url)) {
        return;
      }

      processedUrls.current.add(url);

      try {
        setAuthError("");

        const hashParams = new URLSearchParams(
          callbackUrl.hash.replace(/^#/, ""),
        );
        const callbackError =
          callbackUrl.searchParams.get("error_description") ||
          callbackUrl.searchParams.get("error") ||
          hashParams.get("error_description") ||
          hashParams.get("error");

        if (callbackError) {
          throw new Error(callbackError);
        }

        const code =
          callbackUrl.searchParams.get("code") ||
          hashParams.get("code");

        if (!code) {
          throw new Error("Authentication authorization code is missing.");
        }

        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          throw error;
        }

        await Browser.close().catch(() => {});
      } catch (error) {
        console.error("Authentication callback error:", error);

        processedUrls.current.delete(url);

        if (mounted) {
          setAuthError(error.message || t.callbackFailed);
        }
      }
    }

    async function initialize() {
      try {
        appUrlListener = await CapacitorApp.addListener(
          "appUrlOpen",
          ({ url }) => {
            void handleCallbackUrl(url);
          },
        );

        const launch = await CapacitorApp.getLaunchUrl();

        if (launch?.url) {
          await handleCallbackUrl(launch.url);
        }

        const { data, error } = await supabase.auth.getSession();

        if (error) {
          throw error;
        }

        if (mounted) {
          setSession(data.session);
          setLoading(false);
        }
      } catch (error) {
        console.error("Authentication initialization error:", error);

        if (mounted) {
          setAuthError(error.message || t.callbackFailed);
          setLoading(false);
        }
      }
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (mounted) {
        setSession(nextSession);
        setLoading(false);
      }
    });

    void initialize();

    return () => {
      mounted = false;
      subscription.unsubscribe();
      appUrlListener?.remove();
    };
  }, []);

  // LOAD USER PROFILE
  useEffect(() => {
    if (!session?.user?.id) {
      setProfile(null);
      setProfileStatus("idle");
      setUsername("");
      setUsernameError("");
      return;
    }

    let active = true;

    async function loadProfile() {
      setProfileStatus("loading");
      setUsernameError("");

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, username, display_name")
          .eq("id", session.user.id)
          .maybeSingle();

        if (error) {
          throw error;
        }

        if (!active) {
          return;
        }

        setProfile(data || null);

        if (!data || isTemporaryUsername(data.username)) {
          setProfileStatus("needs-username");
        } else {
          setProfileStatus("complete");
        }
      } catch (error) {
        console.error("Profile loading error:", error);

        if (active) {
          setProfileStatus("error");
        }
      }
    }

    void loadProfile();

    return () => {
      active = false;
    };
  }, [session?.user?.id]);

  // SAVE USERNAME
  async function saveUsername(event) {
    event.preventDefault();

    if (!session?.user?.id || savingUsername) {
      return;
    }

    setUsernameError("");

    const cleanUsername = username.trim().toLowerCase();

    if (!/^[a-z0-9_]{3,30}$/.test(cleanUsername)) {
      setUsernameError(t.invalid);
      return;
    }

    if (isTemporaryUsername(cleanUsername)) {
      setUsernameError(t.temporary);
      return;
    }

    setSavingUsername(true);

    try {
      const {
        data: existing,
        error: checkError,
      } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", cleanUsername)
        .maybeSingle();

      if (checkError) {
        throw checkError;
      }

      if (existing && existing.id !== session.user.id) {
        setUsernameError(t.taken);
        return;
      }

      let result;

      if (profile) {
        result = await supabase
          .from("profiles")
          .update({
            username: cleanUsername,
            updated_at: new Date().toISOString(),
          })
          .eq("id", session.user.id)
          .select("id, username, display_name")
          .single();
      } else {
        result = await supabase
          .from("profiles")
          .insert({
            id: session.user.id,
            username: cleanUsername,
          })
          .select("id, username, display_name")
          .single();
      }

      if (result.error) {
        if (result.error.code === "23505") {
          setUsernameError(t.taken);
          return;
        }

        throw result.error;
      }

      setProfile(result.data);
      setProfileStatus("complete");
    } catch (error) {
      console.error("Username saving error:", error);

      if (error.code === "23505") {
        setUsernameError(t.taken);
      } else {
        setUsernameError(error.message || t.failed);
      }
    } finally {
      setSavingUsername(false);
    }
  }

  // RETRY PROFILE LOADING
  async function retryProfile() {
    if (!session?.user?.id) {
      return;
    }

    setProfileStatus("loading");

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, display_name")
        .eq("id", session.user.id)
        .maybeSingle();

      if (error) {
        throw error;
      }

      setProfile(data || null);

      setProfileStatus(
        !data || isTemporaryUsername(data.username)
          ? "needs-username"
          : "complete"
      );
    } catch (error) {
      console.error("Profile retry error:", error);
      setProfileStatus("error");
    }
  }

  // LOADING
  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          color: "var(--text)",
          background: "var(--bg)",
        }}
      >
        {t.loading}
      </div>
    );
  }

  // NOT SIGNED IN
  if (!session) {
    return (
      <>
        <Auth />

        {authError && (
          <p
            role="alert"
            style={{
              color: "#d33",
              textAlign: "center",
              padding: 12,
            }}
          >
            {authError}
          </p>
        )}
      </>
    );
  }

  // PROFILE LOADING
  if (
    profileStatus === "idle" ||
    profileStatus === "loading"
  ) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          color: "var(--text)",
          background: "var(--bg)",
        }}
      >
        {t.loading}
      </div>
    );
  }

  // PROFILE ERROR
  if (profileStatus === "error") {
    return (
      <main
        dir={isArabic ? "rtl" : "ltr"}
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: 24,
          background: "var(--bg)",
          color: "var(--text)",
          textAlign: "center",
        }}
      >
        <div>
          <h2>{t.profileFailed}</h2>

          <button
            type="button"
            onClick={retryProfile}
          >
            {t.retry}
          </button>

          <button
            type="button"
            onClick={() => supabase.auth.signOut()}
            style={{ marginInlineStart: 12 }}
          >
            {t.logout}
          </button>
        </div>
      </main>
    );
  }

  // NEW ACCOUNT: CHOOSE USERNAME
  if (profileStatus === "needs-username") {
    return (
      <main
        dir={isArabic ? "rtl" : "ltr"}
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: 24,
          background: "var(--bg)",
          color: "var(--text)",
        }}
      >
        <section
          style={{
            width: "100%",
            maxWidth: 440,
            padding: 28,
            border: "1px solid var(--border)",
            borderRadius: 18,
            background: "var(--panel)",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: 2,
              opacity: 0.65,
              marginBottom: 14,
            }}
          >
            LOLZ
          </div>

          <h1 style={{ marginTop: 0 }}>
            {t.title}
          </h1>

          <p style={{ lineHeight: 1.7, opacity: 0.75 }}>
            {t.description}
          </p>

          <form onSubmit={saveUsername}>
            <label
              htmlFor="google-new-username"
              style={{
                display: "block",
                marginBottom: 9,
                fontWeight: 600,
              }}
            >
              {t.username}
            </label>

            <input
              id="google-new-username"
              type="text"
              value={username}
              onChange={(event) =>
                setUsername(event.target.value)
              }
              placeholder={t.placeholder}
              minLength={3}
              maxLength={30}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: 14,
                border: "1px solid var(--border)",
                borderRadius: 10,
                background: "var(--bg)",
                color: "var(--text)",
                fontSize: 16,
              }}
            />

            <p style={{ fontSize: 12, opacity: 0.65 }}>
              {t.hint}
            </p>

            {usernameError && (
              <p
                role="alert"
                style={{
                  color: "#d33",
                  fontSize: 13,
                  marginTop: 12,
                }}
              >
                {usernameError}
              </p>
            )}

            <button
              type="submit"
              disabled={savingUsername}
              style={{
                width: "100%",
                padding: 14,
                marginTop: 18,
                border: "none",
                borderRadius: 10,
                background: "var(--text)",
                color: "var(--bg)",
                fontWeight: 700,
                fontSize: 15,
                cursor: savingUsername ? "wait" : "pointer",
                opacity: savingUsername ? 0.65 : 1,
              }}
            >
              {savingUsername ? t.saving : t.save}
            </button>
          </form>

          <button
            type="button"
            onClick={() => supabase.auth.signOut()}
            style={{
              width: "100%",
              marginTop: 18,
              padding: 10,
              border: "none",
              background: "transparent",
              color: "var(--text)",
              cursor: "pointer",
              opacity: 0.7,
            }}
          >
            {t.logout}
          </button>
        </section>
      </main>
    );
  }

  // PROFILE COMPLETE: OPEN APPLICATION
  return (
    <PreferencesProvider userId={session.user.id}>
      {children}
    </PreferencesProvider>
  );
}
