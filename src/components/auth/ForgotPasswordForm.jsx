"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const redirectTo = new URL("/auth/callback?next=/reset-password", window.location.origin).toString();
      const { error: requestError } = await createSupabaseBrowserClient().auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo },
      );
      if (requestError) throw requestError;
      setMessage("If an account exists for this address, a password reset link is on its way.");
    } catch {
      setError("Password recovery is unavailable right now. Check your email and project configuration, then try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <label>Email<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      {message && <p className="form-success" role="status">{message}</p>}
      <button className="primary-button" type="submit" disabled={busy}>{busy ? "Sending..." : "Send reset link"}</button>
    </form>
  );
}
