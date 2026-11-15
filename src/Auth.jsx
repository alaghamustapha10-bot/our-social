
import { useState } from "react";
import { supabase } from "./supabase";
import "./Auth.css";

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
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
          throw new Error("Username must contain at least 3 characters.");
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

        setMessage(
          "Account created! Please check your email to confirm your account."
        );
        setMessageType("success");
      }
    } catch (error) {
      setMessage(error.message || "Something went wrong. Please try again.");
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  }

  function switchMode() {
    setIsLogin((current) => !current);
    setMessage("");
    setMessageType("");
  }

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <div className="auth-brand">
          <span className="auth-brand-mark">O</span>
          <h1>OUR SOCIAL</h1>
        </div>

        <p className="auth-subtitle">
          {isLogin
            ? "Your world. Your people. Welcome back."
            : "Join the community. Create your space."}
        </p>

        {!isLogin && (
          <div className="auth-field">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              placeholder="Choose a username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              minLength={3}
              maxLength={30}
              autoComplete="username"
              required
            />
          </div>
        )}

        <div className="auth-field">
          <label htmlFor="email">Email address</label>
          <input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </div>

        <div className="auth-field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            autoComplete={isLogin ? "current-password" : "new-password"}
            required
          />
        </div>

        <button
          className="auth-submit"
          type="submit"
          disabled={loading}
        >
          {loading
            ? "Please wait..."
            : isLogin
            ? "Log in"
            : "Create account"}
        </button>

        {message && (
          <p className={`auth-message ${messageType}`} role="status">
            {message}
          </p>
        )}

        <div className="auth-divider">
          <span>OR</span>
        </div>

        <p className="auth-footer">
          {isLogin ? "New to OUR SOCIAL?" : "Already have an account?"}
        </p>

        <button
          type="button"
          className="auth-switch"
          onClick={switchMode}
        >
          {isLogin ? "Create an account" : "Back to log in"}
        </button>

        <p className="auth-legal">
          By continuing, you agree to our community guidelines and terms.
        </p>
      </form>
    </main>
  );
}
