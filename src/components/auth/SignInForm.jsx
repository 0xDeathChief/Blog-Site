"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) {
        setError("Sign in failed. Check your email and password, then try again.");
        return;
      }

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) throw userError ?? new Error("Unable to load your account.");
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userData.user.id)
        .maybeSingle();
      if (profileError || !profile) throw profileError ?? new Error("Unable to load your access profile.");
      const defaultPath = profile.role === "owner" ? "/admin"
        : profile.role === "editor" ? "/editor"
          : profile.role === "contributor" ? "/dashboard"
            : "/profile";
      const requestedPath = new URLSearchParams(window.location.search).get("next") || defaultPath;
      const parsedNext = new URL(requestedPath, window.location.origin);
      const nextPath = requestedPath.startsWith("/")
        && parsedNext.origin === window.location.origin
        ? `${parsedNext.pathname}${parsedNext.search}${parsedNext.hash}`
        : defaultPath;
      window.location.assign(nextPath);
    } catch {
      setError("Sign in is unavailable right now. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <label>
        Email
        <input
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      <label>
        Password
        <input
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="primary-button" type="submit" disabled={loading}>
        {loading ? "Signing in..." : "Sign in"}
      </button>
      <small>Accounts are provided by the CipherBrief owner.</small>
    </form>
  );
}
