"use client";

import { useState } from "react";

export default function AdminSettings({ kind, initial }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  if (kind === "ai") return <AiSettings initial={initial} />;
  return <WebsiteSettings initial={initial} busy={busy} setBusy={setBusy} error={error} setError={setError} notice={notice} setNotice={setNotice} />;
}

function AiSettings({ initial }) {
  const [modelName, setModelName] = useState(initial?.model_name ?? "");
  const [enabled, setEnabled] = useState(initial?.enabled ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/settings/ai", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelName, enabled }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to save AI settings.");
      setNotice("AI settings saved. The model endpoint remains server-configured.");
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="portal-card portal-form" onSubmit={submit}>
      <label>Ollama model<input value={modelName} onChange={(event) => setModelName(event.target.value)} maxLength={128} required placeholder="e.g. a model installed in your Ollama instance" /></label>
      <label className="portal-checkbox"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /> Enable the learning assistant and translation services</label>
      <p className="portal-footnote">Configure the Ollama base URL and service credentials in server environment variables. Secrets are never stored in this form.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      {notice && <p className="form-success" role="status">{notice}</p>}
      <button className="primary-button" type="submit" disabled={busy}>{busy ? "Saving..." : "Save AI settings"}</button>
    </form>
  );
}

function WebsiteSettings({ initial, busy, setBusy, error, setError, notice, setNotice }) {
  const initialValues = Object.fromEntries((initial ?? []).map((setting) => [
    setting.setting_key,
    typeof setting.setting_value === "string" ? setting.setting_value : "",
  ]));
  const [values, setValues] = useState({
    site_title: initialValues.site_title ?? "CipherBrief — Cybersecurity Intelligence",
    site_description: initialValues.site_description ?? "Clear security research, practical guides, and community insights.",
    contact_email: initialValues.contact_email ?? "",
  });
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      for (const [settingKey, value] of Object.entries(values)) {
        const response = await fetch("/api/admin/settings/website", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ settingKey, value }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || `Unable to save ${settingKey}.`);
      }
      setNotice("Website settings saved.");
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="portal-card portal-form" onSubmit={submit}>
      <label>Site title<input value={values.site_title} maxLength={120} onChange={(event) => setValues((current) => ({ ...current, site_title: event.target.value }))} required /></label>
      <label>Site description<textarea value={values.site_description} maxLength={280} rows={3} onChange={(event) => setValues((current) => ({ ...current, site_description: event.target.value }))} required /></label>
      <label>Public contact email<input type="email" value={values.contact_email} maxLength={254} onChange={(event) => setValues((current) => ({ ...current, contact_email: event.target.value }))} /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      {notice && <p className="form-success" role="status">{notice}</p>}
      <button className="primary-button" type="submit" disabled={busy}>{busy ? "Saving..." : "Save website settings"}</button>
    </form>
  );
}
