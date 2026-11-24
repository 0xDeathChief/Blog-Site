"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Clock3, ImagePlus, Save, Send } from "lucide-react";
import ArticleEditor from "./ArticleEditor";

const difficultyOptions = ["beginner", "intermediate", "advanced", "expert"];

function formatStatus(status) {
  return status.replaceAll("_", " ");
}

export default function ArticleWorkspace({
  article,
  authorName,
  categories,
  tags,
  role,
  userId,
  events = [],
  feedback = [],
  revisions = [],
  coverUrl = null,
}) {
  const router = useRouter();
  const isNew = !article;
  const [values, setValues] = useState({
    title: article?.title ?? "",
    slug: article?.slug ?? "",
    summary: article?.summary ?? "",
    content: article?.content ?? { type: "doc", content: [{ type: "paragraph" }] },
    categoryId: article?.category_id ?? "",
    coverImagePath: article?.cover_image_path ?? "",
    difficulty: article?.difficulty ?? "beginner",
    tagIds: article?.article_tags?.map((row) => row.tag_id) ?? [],
  });
  const [imageUrl, setImageUrl] = useState(coverUrl);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [reviewNote, setReviewNote] = useState("");

  function updateField(name, value) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  function updateTitle(title) {
    const shouldUpdateSlug = !values.slug || values.slug === slugify(values.title);
    setValues((current) => ({
      ...current,
      title,
      ...(shouldUpdateSlug ? { slug: slugify(title) } : {}),
    }));
  }

  async function uploadCover(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const body = new FormData();
      body.set("file", file);
      if (article?.id) body.set("articleId", article.id);
      const response = await fetch("/api/article-covers", { method: "POST", body });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to upload this image.");
      updateField("coverImagePath", result.path);
      setImageUrl(result.url);
      setMessage("Cover image uploaded.");
    } catch (uploadError) {
      setError(uploadError.message);
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  }

  async function persistArticle() {
    setError("");
    setMessage("");
    if (values.title.trim().length < 5 || values.title.trim().length > 120) {
      throw new Error("The title must be between 5 and 120 characters.");
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(values.slug)) {
      throw new Error("Use a lowercase URL slug with letters, numbers, and hyphens.");
    }
    if (values.summary.trim().length < 20 || values.summary.trim().length > 280) {
      throw new Error("The short description must be between 20 and 280 characters.");
    }
    if (!values.categoryId) {
      throw new Error("Choose a category before saving.");
    }
    const response = await fetch(isNew ? "/api/articles" : `/api/articles/${article.id}`, {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...values,
        categoryId: values.categoryId || null,
        coverImagePath: values.coverImagePath || null,
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Unable to save this article.");
    if (isNew) {
      router.replace(`/dashboard/articles/${result.id}`);
    } else {
      setMessage("Article changes saved.");
      router.refresh();
    }
    return result.id;
  }

  async function saveArticle() {
    setBusy(true);
    try {
      await persistArticle();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setBusy(false);
    }
  }

  async function changeWorkflow(action) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (isNew) throw new Error("Save the article before submitting it for review.");
      await persistArticle();
      const response = await fetch(`/api/articles/${article.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, feedback: reviewNote }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to update the article status.");
      setReviewNote("");
      setMessage("Article status updated.");
      router.refresh();
    } catch (workflowError) {
      setError(workflowError.message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteArticle() {
    if (!window.confirm("Permanently delete this article and its revision history?")) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/articles/${article.id}`, { method: "DELETE" });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Unable to delete this article.");
      }
      router.replace("/dashboard/articles");
      router.refresh();
    } catch (deleteError) {
      setError(deleteError.message);
    } finally {
      setBusy(false);
    }
  }

  const status = article?.status ?? "draft";
  const canEdit = isNew
    || role === "owner"
    || (role === "editor" && ["submitted", "in_review"].includes(status))
    || (role === "contributor" && article?.author_id === userId
      && ["draft", "revision_requested", "rejected"].includes(status));
  const canSubmit = ["owner", "contributor"].includes(role)
    && article?.author_id === userId
    && ["draft", "revision_requested", "rejected"].includes(status);
  const canStartReview = ["owner", "editor"].includes(role) && status === "submitted";
  const canRequestRevision = ["owner", "editor"].includes(role) && status === "in_review";
  const canReject = ["owner", "editor"].includes(role) && ["submitted", "in_review"].includes(status);
  const canApprove = ["owner", "editor"].includes(role) && status === "in_review";
  const canPublish = role === "owner" && ["approved", "unpublished"].includes(status);
  const canUnpublish = role === "owner" && status === "published";
  const canChangeWorkflow = canSubmit || canStartReview || canRequestRevision || canReject || canApprove || canPublish || canUnpublish;

  return (
    <main className="article-management-page">
      <div className="shell">
        <Link className="back-link" href="/dashboard/articles"><ArrowLeft size={16} /> Article workspace</Link>
        <div className="workspace-heading">
          <div>
            <span className="section-kicker">{isNew ? "NEW CONTRIBUTION" : "ARTICLE WORKSPACE"}</span>
            <h1>{isNew ? "Build a useful security guide." : article.title}</h1>
            <p>{isNew ? "Write clearly, preserve technical detail, and submit when the draft is ready." : `By ${authorName} · ${formatStatus(status)}`}</p>
          </div>
          {!isNew && <span className={`status-pill status-${status}`}>{formatStatus(status)}</span>}
        </div>

        <div className="workspace-grid">
          <section className="workspace-main">
            <div className="workspace-card">
              <div className="form-grid">
                <label className="form-field form-field-wide">
                  Article title
                  <input required disabled={!canEdit} value={values.title} maxLength={120} onChange={(event) => updateTitle(event.target.value)} placeholder="A clear, specific title" />
                </label>
                <label className="form-field form-field-wide">
                  URL slug
                  <input required disabled={!canEdit} value={values.slug} maxLength={160} onChange={(event) => updateField("slug", slugify(event.target.value))} placeholder="article-url-slug" />
                </label>
                <label className="form-field form-field-wide">
                  Short description
                  <textarea required disabled={!canEdit} value={values.summary} minLength={20} maxLength={280} rows={3} onChange={(event) => updateField("summary", event.target.value)} placeholder="What should a reader learn from this article?" />
                  <small>{values.summary.length}/280 characters</small>
                </label>
                <label className="form-field">
                  Category
                  <select required disabled={!canEdit} value={values.categoryId} onChange={(event) => updateField("categoryId", event.target.value)}>
                    <option value="">Choose a category</option>
                    {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                  </select>
                </label>
                <label className="form-field">
                  Difficulty
                  <select disabled={!canEdit} value={values.difficulty} onChange={(event) => updateField("difficulty", event.target.value)}>
                    {difficultyOptions.map((difficulty) => (
                      <option key={difficulty} value={difficulty}>{capitalize(difficulty)}</option>
                    ))}
                  </select>
                </label>
                <label className="form-field">
                  Author
                  <input value={authorName} readOnly aria-readonly="true" />
                </label>
                <label className="form-field">
                  Reading time
                  <input value={article ? `${article.reading_time_minutes} min` : "Calculated on save"} readOnly aria-readonly="true" />
                </label>
                <fieldset className="form-field form-field-wide tag-picker">
                  <legend>Tags <small>Select up to 10</small></legend>
                  {tags.length ? (
                    <div className="tag-options">
                      {tags.map((tag) => (
                        <label className="tag-option" key={tag.id}>
                          <input
                            type="checkbox"
                            disabled={!canEdit}
                            checked={values.tagIds.includes(tag.id)}
                            onChange={(event) => updateField(
                              "tagIds",
                              event.target.checked
                                ? [...values.tagIds, tag.id].slice(0, 10)
                                : values.tagIds.filter((id) => id !== tag.id),
                            )}
                          />
                          {tag.name}
                        </label>
                      ))}
                    </div>
                  ) : <small>No tags are configured yet.</small>}
                </fieldset>
                <div className="form-field form-field-wide">
                  <span className="field-label">Cover image</span>
                  {canEdit && ["owner", "contributor"].includes(role) && (
                    <label className="upload-control">
                      <ImagePlus size={18} />
                      <span>{busy ? "Uploading..." : "Choose JPEG, PNG, WebP, or AVIF (max 5 MB)"}</span>
                      <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={uploadCover} disabled={busy} />
                    </label>
                  )}
                  {role === "editor" && <small>Cover images are managed by the author or owner.</small>}
                  {imageUrl && (
                    <div className="cover-preview">
                      <Image src={imageUrl} alt="Article cover preview" width={720} height={300} unoptimized />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="workspace-card editor-card">
              <div className="card-heading">
                <div><h2>Article content</h2><p>Technical snippets, commands, and structured explanations are supported.</p></div>
                <span className="read-time-note"><Clock3 size={15} /> Calculated on save</span>
              </div>
              <ArticleEditor content={values.content} onChange={(content) => updateField("content", content)} readOnly={!canEdit} />
            </div>

            {error && <p className="workspace-alert workspace-alert-error" role="alert">{error}</p>}
            {message && <p className="workspace-alert workspace-alert-success" role="status">{message}</p>}
            <div className="workspace-actions">
              {canEdit && (
                <button className="primary-button" type="button" onClick={saveArticle} disabled={busy}>
                  <Save size={16} /> {busy ? "Saving..." : isNew ? "Save draft" : "Save changes"}
                </button>
              )}
              {canSubmit && !isNew && (
                <button className="secondary-button" type="button" onClick={() => changeWorkflow("submit")} disabled={busy}>
                  <Send size={16} /> Submit for review
                </button>
              )}
            </div>
          </section>

          <aside className="workspace-sidebar">
            {!isNew && (
              <>
                <section className="workspace-card workflow-card">
                  <span className="section-kicker">EDITORIAL WORKFLOW</span>
                  <h2>{capitalize(formatStatus(status))}</h2>
                  <p>{workflowDescription(status)}</p>
                  {(canRequestRevision || canReject || canApprove) && (
                    <label className="form-field feedback-field">
                      Review note
                      <textarea
                        rows={4}
                        maxLength={4000}
                        value={reviewNote}
                        onChange={(event) => setReviewNote(event.target.value)}
                        placeholder="Required for revision requests and rejections."
                      />
                    </label>
                  )}
                  <div className="workflow-buttons">
                    {canStartReview && <button className="secondary-button" type="button" disabled={busy} onClick={() => changeWorkflow("start_review")}>Start review</button>}
                    {canRequestRevision && <button className="secondary-button" type="button" disabled={busy || !reviewNote.trim()} onClick={() => changeWorkflow("request_revision")}>Request revision</button>}
                    {canReject && <button className="danger-button" type="button" disabled={busy || !reviewNote.trim()} onClick={() => changeWorkflow("reject")}>Reject</button>}
                    {canApprove && <button className="primary-button" type="button" disabled={busy} onClick={() => changeWorkflow("approve")}>Approve for owner</button>}
                    {canPublish && <button className="primary-button" type="button" disabled={busy} onClick={() => changeWorkflow("publish")}>Publish article</button>}
                    {canUnpublish && <button className="secondary-button" type="button" disabled={busy} onClick={() => changeWorkflow("unpublish")}>Unpublish</button>}
                  </div>
                  {role !== "owner" && status === "approved" && <p className="permission-note">Owner approval is complete. Only the owner can publish this article.</p>}
                  {role === "owner" && (
                    <button className="danger-button delete-article-button" type="button" disabled={busy} onClick={deleteArticle}>
                      Delete article
                    </button>
                  )}
                  {!canEdit && !canChangeWorkflow && <p className="permission-note">This article is read-only in its current workflow state.</p>}
                </section>
                <HistoryPanel events={events} feedback={feedback} revisions={revisions} />
              </>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}

function HistoryPanel({ events, feedback, revisions }) {
  return (
    <section className="workspace-card history-card">
      <span className="section-kicker">REVIEW & REVISION HISTORY</span>
      {!events.length && !feedback.length && !revisions.length ? (
        <p className="history-empty">History will appear after the first save or review action.</p>
      ) : (
        <div className="history-list">
          {events.map((event) => (
            <article className="history-item" key={`event-${event.id}`}>
              <span className="history-dot" />
              <div>
                <strong>{event.actor_name}</strong>
                <p>{event.from_status ? `${formatStatus(event.from_status)} → ${formatStatus(event.to_status)}` : event.action}</p>
                <time dateTime={event.created_at}>{formatDate(event.created_at)}</time>
              </div>
            </article>
          ))}
          {feedback.map((item) => (
            <article className="history-feedback" key={`feedback-${item.id}`}>
              <strong>{item.reviewer_name} · {formatStatus(item.kind)}</strong>
              <p>{item.message}</p>
              <time dateTime={item.created_at}>{formatDate(item.created_at)}</time>
            </article>
          ))}
          {revisions.map((revision) => (
            <details className="revision-item" key={`revision-${revision.id}`}>
              <summary>{revision.title} <time dateTime={revision.created_at}>{formatDate(revision.created_at)}</time></summary>
              <p>{revision.summary}</p>
              <small>/{revision.slug} · {capitalize(revision.difficulty)} · {revision.reading_time_minutes} min read · {revision.tags.map((tag) => tag.name).join(", ") || "No tags"}</small>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}

function slugify(value) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 160);
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function workflowDescription(status) {
  const descriptions = {
    draft: "Keep writing, then send the draft to the editorial team.",
    submitted: "The article is waiting for an editor to begin review.",
    in_review: "An editor is checking clarity, accuracy, and usefulness.",
    revision_requested: "Review the feedback, update the draft, and submit again.",
    rejected: "The editor left a decision and feedback for the contributor.",
    approved: "Editorial review is complete. The owner has final publishing authority.",
    published: "This article is available to readers.",
    unpublished: "This article is no longer public and can be published again by the owner.",
  };
  return descriptions[status] ?? "Article workflow status.";
}
