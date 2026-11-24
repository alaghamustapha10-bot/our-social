
import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import "./Auth.css";

const GOOGLE_REDIRECT_URL =
  "com.oursocial.app://login-callback";

const translations = {
  en: {
    welcome: "A place for your people.",
    description: "Connect, share, and discover what matters to you.",
    loginTitle: "Welcome back",
    signupTitle: "Create your account",
    loginSubtitle: "Your world is waiting for you.",
    signupSubtitle: "Your next chapter starts here.",
    username: "Username",
    usernamePlaceholder: "Choose a username",
    email: "Email address",
    emailPlaceholder: "you@example.com",
    password: "Password",
    passwordPlaceholder: "Enter your password",
    login: "Log in",
    signup: "Create account",
    loading: "Please wait...",
    or: "OR CONTINUE WITH",
    google: "Continue with Google",
    noAccount: "New to OUR SOCIAL?",
    hasAccount: "Already have an account?",
    createAccount: "Create an account",
    backToLogin: "Back to log in",
    terms: "By continuing, you agree to our community guidelines and terms.",
    footer: "A social space made for real connections.",
    usernameError: "Username must contain at least 3 characters.",
    signupSuccess: "Account created! Please check your email to confirm your account.",
    genericError: "Something went wrong. Please try again.",
    googleError: "Google sign-in could not be started. Please try again.",
  },
  ar: {
    welcome: "مساحة تجمعك بمن يهمّك.",
    description: "تواصل، شارك، واكتشف الأشياء التي تهمك.",
    loginTitle: "مرحباً بعودتك",
    signupTitle: "أنشئ حسابك",
    loginSubtitle: "مساحتك وأصدقاؤك بانتظارك.",
    signupSubtitle: "حكايتك الجديدة تبدأ من هنا.",
    username: "اسم المستخدم",
    usernamePlaceholder: "اختر اسم مستخدم",
    email: "البريد الإلكتروني",
    emailPlaceholder: "you@example.com",
    password: "كلمة المرور",
    passwordPlaceholder: "أدخل كلمة المرور",
    login: "تسجيل الدخول",
    signup: "إنشاء حساب",
    loading: "يرجى الانتظار...",
    or: "أو تابع باستخدام",
    google: "المتابعة باستخدام Google",
    noAccount: "جديد في OUR SOCIAL؟",
    hasAccount: "لديك حساب بالفعل؟",
    createAccount: "إنشاء حساب جديد",
    backToLogin: "العودة لتسجيل الدخول",
    terms: "بمتابعتك، فإنك توافق على إرشادات المجتمع والشروط الخاصة بنا.",
    footer: "مساحة اجتماعية لعلاقات حقيقية.",
    usernameError: "يجب أن يتكون اسم المستخدم من 3 أحرف على الأقل.",
    signupSuccess: "تم إنشاء الحساب! تحقق من بريدك الإلكتروني لتأكيد حسابك.",
    genericError: "حدث خطأ ما. يرجى المحاولة مرة أخرى.",
    googleError: "تعذّر بدء تسجيل الدخول عبر Google. حاول مرة أخرى.",
  },
};

function getInitialLanguage() {
  try {
    const saved = localStorage.getItem("our-social-language");

    if (saved === "ar" || saved === "en") return saved;
  } catch {
    // Local storage may be unavailable.
  }

  return document.documentElement.lang === "ar" ? "ar" : "en";
}

export default function Auth() {
  const [language, setLanguage] = useState(getInitialLanguage);
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const t = translations[language];
  const isArabic = language === "ar";

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = isArabic ? "rtl" : "ltr";

    try {
      localStorage.setItem("our-social-language", language);
    } catch {
      // Continue even if local storage is unavailable.
    }
  }, [language, isArabic]);

  // Restore the Google button when the external browser is closed.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let listener;
    let disposed = false;

    Browser.addListener("browserFinished", () => {
      setLoading(false);
    })
      .then((handle) => {
        if (disposed) {
          handle.remove();
        } else {
          listener = handle;
        }
      })
      .catch((error) => {
        console.error("Browser listener error:", error);
      });

    return () => {
      disposed = true;
      listener?.remove();
    };
  }, []);

  function changeLanguage() {
    setLanguage((current) => (current === "ar" ? "en" : "ar"));
    setMessage("");
    setMessageType("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setMessageType("");

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) throw error;
      } else {
        const cleanUsername = username.trim();

        if (cleanUsername.length < 3) {
          throw new Error(t.usernameError);
        }

        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              username: cleanUsername,
            },
          },
        });

        if (error) throw error;

        setMessage(t.signupSuccess);
        setMessageType("success");
      }
    } catch (error) {
      setMessage(error.message || t.genericError);
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setLoading(true);
    setMessage("");
    setMessageType("");

    try {
      const isNative = Capacitor.isNativePlatform();

      const { data, error } =
        await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: isNative
              ? GOOGLE_REDIRECT_URL
              : window.location.origin,

            skipBrowserRedirect: isNative,
          },
        });

      if (error) throw error;

      if (isNative) {
        if (!data?.url) {
          throw new Error("Google OAuth URL was not returned.");
        }

        await Browser.open({
          url: data.url,
        });
      }
    } catch (error) {
      console.error("Google login error:", error);

      setMessage(
        error.message || t.googleError
      );

      setMessageType("error");
      setLoading(false);
    }
  }

  function switchMode() {
    setIsLogin((current) => !current);
    setMessage("");
    setMessageType("");
    setPassword("");
  }

  return (
    <main className="auth-page" dir={isArabic ? "rtl" : "ltr"}>
      <div className="auth-topbar">
        <a className="auth-logo" href="/" aria-label="OUR SOCIAL">
          <span className="auth-logo-mark">O</span>
          <span>OUR SOCIAL</span>
        </a>

        <button
          type="button"
          className="auth-language"
          onClick={changeLanguage}
          aria-label={isArabic ? "Switch to English" : "التبديل إلى العربية"}
        >
          <span className="auth-language-icon">文</span>
          {isArabic ? "English" : "العربية"}
        </button>
      </div>

      <div className="auth-layout">
        <section className="auth-intro">
          <div className="auth-intro-content">
            <span className="auth-overline">
              <span className="auth-status-dot" />
              YOUR SOCIAL SPACE
            </span>

            <h1>
              {isArabic ? (
                <>
                  {t.welcome}
                  <span> بطريقتك.</span>
                </>
              ) : (
                <>
                  A place for
                  <br />
                  <span>your people.</span>
                </>
              )}
            </h1>

            <p>{t.description}</p>

            <div className="auth-intro-decoration" aria-hidden="true">
              <div className="auth-orbit auth-orbit-one" />
              <div className="auth-orbit auth-orbit-two" />
              <div className="auth-orbit auth-orbit-three" />
              <div className="auth-orbit-center">O</div>
            </div>
          </div>

          <div className="auth-intro-footer">
            <span>OUR SOCIAL</span>
            <span>01 — CONNECT</span>
          </div>
        </section>

        <section className="auth-form-section">
          <div className="auth-card">
            <div className="auth-card-heading">
              <span className="auth-card-label">
                {isLogin ? "YOUR SPACE" : "JOIN THE COMMUNITY"}
              </span>

              <h2>{isLogin ? t.loginTitle : t.signupTitle}</h2>
              <p>{isLogin ? t.loginSubtitle : t.signupSubtitle}</p>
            </div>

            <form onSubmit={handleSubmit} className="auth-form">
              {!isLogin && (
                <div className="auth-field">
                  <label htmlFor="auth-username">{t.username}</label>
                  <input
                    id="auth-username"
                    type="text"
                    placeholder={t.usernamePlaceholder}
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    minLength={3}
                    maxLength={30}
                    autoComplete="username"
                    required
                  />
                </div>
              )}

              <div className="auth-field">
                <label htmlFor="auth-email">{t.email}</label>
                <input
                  id="auth-email"
                  type="email"
                  placeholder={t.emailPlaceholder}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                />
              </div>

              <div className="auth-field">
                <label htmlFor="auth-password">{t.password}</label>

                <div className="auth-password-wrap">
                  <input
                    id="auth-password"
                    type={showPassword ? "text" : "password"}
                    placeholder={t.passwordPlaceholder}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    minLength={6}
                    autoComplete={
                      isLogin ? "current-password" : "new-password"
                    }
                    required
                  />

                  <button
                    type="button"
                    className="auth-password-toggle"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <button
                className="auth-submit"
                type="submit"
                disabled={loading}
              >
                <span>
                  {loading
                    ? t.loading
                    : isLogin
                      ? t.login
                      : t.signup}
                </span>

                {!loading && (
                  <span className="auth-submit-arrow" aria-hidden="true">
                    {isArabic ? "←" : "→"}
                  </span>
                )}
              </button>
            </form>

            {message && (
              <p
                className={`auth-message ${messageType}`}
                role="status"
                aria-live="polite"
              >
                {message}
              </p>
            )}

            <div className="auth-divider">
              <span>{t.or}</span>
            </div>

            <button
              type="button"
              className="auth-google"
              onClick={handleGoogleLogin}
              disabled={loading}
            >
              <span className="auth-google-icon" aria-hidden="true">
                G
              </span>
              {t.google}
            </button>

            <div className="auth-switch-area">
              <span>{isLogin ? t.noAccount : t.hasAccount}</span>

              <button
                type="button"
                className="auth-switch"
                onClick={switchMode}
              >
                {isLogin ? t.createAccount : t.backToLogin}
              </button>
            </div>

            <p className="auth-legal">{t.terms}</p>
          </div>
        </section>
      </div>

      <footer className="auth-page-footer">
        <span>{t.footer}</span>
        <span>© {new Date().getFullYear()} OUR SOCIAL</span>
      </footer>
    </main>
  );
}
