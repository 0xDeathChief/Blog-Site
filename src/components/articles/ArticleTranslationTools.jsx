"use client";

import { useState } from "react";
import { Eye, EyeOff, Languages, LoaderCircle } from "lucide-react";

const translationStyles = [
  ["simple_bangla", "Simple Bangla"],
  ["professional_bangla", "Professional Bangla"],
  ["bangla_technical", "Bangla + English technical terms"],
];

export default function ArticleTranslationTools({
  articleSlug,
  translatedContent,
  translationMeta,
  showTranslation,
  onTranslatedContent,
  onShowTranslation,
}) {
  const [targetLanguage, setTargetLanguage] = useState("bangla");
  const [style, setStyle] = useState("bangla_technical");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function requestTranslation(body) {
    setBusy(body.kind);
    setError("");
    try {
      const response = await fetch("/api/ai/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Translation failed.");
      return result;
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Translation failed.");
      return null;
    } finally {
      setBusy("");
    }
  }

  async function translateArticle() {
    const result = await requestTranslation({
      kind: "article",
      articleSlug,
      targetLanguage,
      style,
    });
    if (result?.kind === "document") {
      onTranslatedContent(
        { content: result.content, title: result.title, summary: result.summary },
        { targetLanguage, style },
      );
      onShowTranslation(true);
    }
  }

  return (
    <section className="article-translation-tools" aria-label="Article translation">
      <div className="translation-tools-heading">
        <span className="translation-tools-icon"><Languages size={17} /></span>
        <div>
          <h2>Translate this article</h2>
          <p>Generated on demand; the original article is never changed.</p>
        </div>
      </div>

      <div className="translation-settings">
        <label>
          <span>Translate to</span>
          <select value={targetLanguage} onChange={(event) => setTargetLanguage(event.target.value)}>
            <option value="bangla">Bangla</option>
            <option value="english">English</option>
          </select>
        </label>
        <label>
          <span>Bangla style</span>
          <select value={style} onChange={(event) => setStyle(event.target.value)} disabled={targetLanguage === "english"}>
            {translationStyles.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select>
        </label>
      </div>

      <div className="translation-actions">
        <button className="secondary-button" type="button" onClick={translateArticle} disabled={Boolean(busy)}>
          {busy === "article" ? <LoaderCircle size={14} className="assistant-spinner" /> : <Languages size={14} />}
          {busy === "article" ? "Translating article…" : "Translate full article"}
        </button>
        {translatedContent && (
          <button className="translation-toggle-button" type="button" onClick={() => onShowTranslation(!showTranslation)}>
            {showTranslation ? <EyeOff size={14} /> : <Eye size={14} />}
            {showTranslation ? "Show original" : "Show translation"}
          </button>
        )}
      </div>

      {translationMeta && (
        <p className="translation-version">
          Current translation: {translationMeta.targetLanguage === "bangla" ? "Bangla" : "English"}
          {translationMeta.targetLanguage === "bangla" ? ` · ${translationStyles.find(([value]) => value === translationMeta.style)?.[1]}` : ""}
        </p>
      )}

      {error && <p className="workspace-alert workspace-alert-error" role="alert">{error}</p>}
    </section>
  );
}
