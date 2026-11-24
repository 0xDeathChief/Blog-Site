"use client";

import { useState } from "react";

export default function ProfileSettingsForm({ displayName, avatarUrl }) {
  const [name, setName] = useState(displayName);
  const [avatar, setAvatar] = useState(avatarUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: name, avatarUrl: avatar }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to update your profile.");
      setSaved(true);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="portal-form" onSubmit={submit}>
      <label>Display name<input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required /></label>
      <label>Avatar URL <small>Optional; HTTPS only.</small><input type="url" value={avatar} onChange={(event) => setAvatar(event.target.value)} maxLength={500} placeholder="https://example.com/avatar.png" /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      {saved && <p className="form-success" role="status">Profile updated.</p>}
      <button className="primary-button" type="submit" disabled={busy}>{busy ? "Saving..." : "Save profile"}</button>
    </form>
  );
}
