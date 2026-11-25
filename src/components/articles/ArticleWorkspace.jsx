"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Clock3, ImagePlus, Save, Send } from "lucide-react";
import ArticleEditor from "./ArticleEditor";
import PortalHeader from "@/components/portal/PortalHeader";

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
  const [savedId, setSavedId] = useState(article?.id ?? null);
  const [status, setStatus] = useState(article?.status ?? "draft");
  const isNew = !article;
  const [values, setValues] = useState({
    title: article?.title ?? "",
    slug: article?.slug ?? "",
    summary: article?.summary ?? "",
    content: article?.content ?? { type: "doc", content: [{ type: "paragraph" }] },
    categoryId: article?.category_id ?? categories.find(c => c.name.toLowerCase() === "general")?.id ?? "",
    categorySuggestion: article?.category_suggestion ?? "",
    coverImagePath: article?.cover_image_path ?? "",
    difficulty: article?.difficulty ?? "beginner",
    tagIds: article?.article_tags?.map((row) => row.tag_id) ?? [],
  });
  const [preview, setPreview] = useState(false);
  const [imageUrl, setImageUrl] = useState(coverUrl);
  const [busy, setBusy] = useState(false);
  const [editorBusy, setEditorBusy] = useState(false);
  const [customCategory, setCustomCategory] = useState(Boolean(article?.category_suggestion));
  const [markdownOpen, setMarkdownOpen] = useState(false);
  const locked = busy || editorBusy || markdownOpen;
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
      ...(shouldUpdateSlug || !slugify(current.title) ? { slug: slugify(title) || (title.trim() ? `story-${crypto.randomUUID().slice(0,12)}` : "") } : {}),
    }));
  }

  async function uploadCover(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const count = node => (node?.type === "image" ? 1 : 0) + (node?.content ?? []).reduce((sum, child)=>sum + count(child),0);
    if (count(values.content) >= 3) {setError("Remove an inline image before adding a cover.");event.target.value="";return;}
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
      setMessage(`Cover uploaded · ${Math.ceil(result.storedBytes/1024)} KB stored (lossless encoding).`);
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
    if (customCategory && !values.categorySuggestion.trim()) throw new Error("Enter your suggested category.");
    if (!values.categoryId) {
      throw new Error("Choose a category before saving.");
    }
    const countImages = (node) => (node?.type === "image" ? 1 : 0) + (Array.isArray(node?.content) ? node.content.reduce((n,child)=>n+countImages(child),0) : 0);
    if (countImages(values.content) + (values.coverImagePath ? 1 : 0) > 3) throw new Error("Maximum 3 images, including the cover.");
    const response = await fetch(!savedId ? "/api/articles" : `/api/articles/${savedId}`, {
      method: !savedId ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...values,
        categorySuggestion: customCategory ? values.categorySuggestion.trim() : "",
        categoryId: values.categoryId || null,
        coverImagePath: values.coverImagePath || null,
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Unable to save this article.");
    const id = result.id || savedId;
    if (!id) throw new Error("The server did not return an article ID.");
    setSavedId(id);
    return id;
  }

  async function saveArticle() {
    setBusy(true);
    try {
      const id = await persistArticle();
      setMessage("Draft / changes saved.");
      if (isNew) router.replace(`/dashboard/articles/${id}`);
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
      let id = savedId;
      if (action === "submit" || (canEdit && !isNew)) id = await persistArticle();
      if (!id) throw new Error("Save the article first.");
      const response = await fetch(`/api/articles/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, feedback: reviewNote }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to update the article status.");
      setReviewNote("");
      setMessage(action === "submit" ? "Submitted for editorial review. Not public yet." : "Article status updated.");
      const next={submit:"submitted",start_review:"in_review",request_revision:"revision_requested",reject:"rejected",approve:"approved",approve_publish:"published",publish:"published",unpublish:"unpublished"}[action];
      if(next)setStatus(next);
      if(action==="approve_publish"||action==="publish")setMessage("Published. Open the public article using the link above.");
      if (isNew) router.replace(`/dashboard/articles/${id}`);
    } catch (workflowError) {
      setError(workflowError.message + (isNew ? " If the draft was saved, retry here or open My articles." : ""));
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
      router.replace(role === "owner" ? "/admin/articles" : "/dashboard/articles");
    } catch (deleteError) {
      setError(deleteError.message);
    } finally {
      setBusy(false);
    }
  }

  // Status is updated locally after the server confirms each transition.
  const canEdit = isNew
    || role === "owner"
    || (role === "editor" && ["submitted", "in_review"].includes(status))
    || (role === "contributor" && article?.author_id === userId
      && ["draft", "revision_requested", "rejected"].includes(status));
  const canSubmit = ["owner", "contributor"].includes(role)
    && (isNew || article?.author_id === userId)
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
        <PortalHeader displayName={role === "owner" ? "Publishing studio" : "Writing workspace"} role={role} />
        <Link className="back-link" href={role === "owner" ? "/admin/articles" : "/dashboard/articles"}><ArrowLeft size={16} /> Article workspace</Link>
        <div className="workspace-heading">
          <div>
            <span className="section-kicker">{isNew ? "NEW CONTRIBUTION" : "ARTICLE WORKSPACE"}</span>
            <h1>{isNew ? "Build a useful security guide." : article.title}</h1>
            {status==="published" && <Link className="secondary-button" href={`/articles/${values.slug}`} target="_blank" rel="noopener noreferrer">View published article ↗</Link>}
            <p>{isNew ? "Write clearly, preserve technical detail, and submit when the draft is ready." : `By ${authorName} · ${formatStatus(status)}`}</p>
          </div>
          {!isNew && <span className={`status-pill status-${status}`}>{formatStatus(status)}</span>}
        </div>

        <div className="cb-workspace-nav">
          {canEdit && <button type="button" className="secondary-button" disabled={locked} onClick={saveArticle}><Save size={16}/> {isNew ? "Save draft" : "Save changes"}</button>}
          {canSubmit && <button type="button" className="primary-button" disabled={locked} onClick={() => changeWorkflow("submit")}><Send size={16}/> Upload for review</button>}
          {canStartReview && <button type="button" className="primary-button" disabled={locked} onClick={() => changeWorkflow("start_review")}>Start review</button>}
          {canApprove && <button type="button" className="primary-button" disabled={locked} onClick={() => changeWorkflow(role === "owner" ? "approve_publish" : "approve")}>{role === "owner" ? "Approve & publish" : "Approve"}</button>}
          {canPublish && <button type="button" className="primary-button" disabled={locked} onClick={() => changeWorkflow("publish")}>Publish article</button>}
          {!isNew && <a className="secondary-button" href="#editorial-controls">Review controls & history</a>}
          {markdownOpen && <small>Apply Markdown before saving or submitting.</small>}
          {editorBusy && <small>Image upload in progress.</small>}
        </div>
        {error && <p className="workspace-alert workspace-alert-error" role="alert">{error}</p>}
        {message && <p className="workspace-alert workspace-alert-success" role="status">{message}</p>}
        <div className="workspace-grid">
          <section className="workspace-main">
            <div className="workspace-card">
              <div className="form-grid">
                <label className="form-field form-field-wide">
                  Article title
                  <input required disabled={!canEdit || busy} value={values.title} maxLength={120} onChange={(event) => updateTitle(event.target.value)} placeholder="A clear, specific title" />
                </label>
                <label className="form-field form-field-wide">
                  URL slug
                  <input required disabled={!canEdit || busy} value={values.slug} maxLength={160} onChange={(event) => updateField("slug", slugify(event.target.value))} placeholder="article-url-slug" />
                </label>
                <label className="form-field form-field-wide">
                  Short description
                  <textarea required disabled={!canEdit || busy} value={values.summary} minLength={20} maxLength={280} rows={3} onChange={(event) => updateField("summary", event.target.value)} placeholder="What should a reader learn from this article?" />
                  <small>{values.summary.length}/280 characters</small>
                </label>
              </div>
            </div>
            <div className="workspace-card editor-card">
              <div className="card-heading">
                <div><h2>Article content</h2><p>Technical snippets, commands, and structured explanations are supported.</p></div>
                <span className="read-time-note"><Clock3 size={15} /> Calculated on save</span>{canEdit && <button className="secondary-button" type="button" disabled={locked} onClick={()=>setPreview(v=>!v)}>{preview ? "Back to writing" : "Reading preview"}</button>}
              </div>
              <ArticleEditor content={values.content} onChange={(content) => updateField("content", content)} readOnly={!canEdit || preview} disabled={busy} coverCount={values.coverImagePath ? 1 : 0} onBusyChange={setEditorBusy} onMarkdownChange={setMarkdownOpen} />
            </div>
            <div className="workspace-card"><div className="card-heading"><div><h2>Publishing details</h2><p>Choose a topic and optional images.</p></div></div><div className="form-grid">
                <label className="form-field">
                  Category (existing / fallback)
                  <select required disabled={!canEdit || busy} value={values.categoryId} onChange={(event) => updateField("categoryId", event.target.value)}>
                    <option value="">Choose a category</option>
                    {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                  </select>
                </label>
                <div className="form-field form-field-wide cb-category-suggestion">
                  <label><input type="checkbox" checked={customCategory} disabled={!canEdit || busy} onChange={event => {setCustomCategory(event.target.checked); if(event.target.checked && !values.categoryId) updateField("categoryId",categories.find(c=>c.name.toLowerCase()==="general")?.id ?? "");}} /> Suggest a custom category</label>
                  {customCategory && <><input aria-label="Suggested category" maxLength={80} disabled={!canEdit || busy} value={values.categorySuggestion} onChange={event=>updateField("categorySuggestion",event.target.value)} placeholder="e.g. Digital Forensics" /><small>Choose General or another existing category above. The owner can create and assign your suggested category during review.</small>{role === "owner" && <div className="cb-workspace-nav"><Link href="/admin/categories" target="_blank" className="secondary-button">Manage categories ↗</Link><button type="button" className="secondary-button" disabled={locked} onClick={()=>router.refresh()}>Reload categories</button></div>}</>}
                </div>
                <label className="form-field">
                  Difficulty
                  <select disabled={!canEdit || busy} value={values.difficulty} onChange={(event) => updateField("difficulty", event.target.value)}>
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
                            disabled={!canEdit || busy}
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
                  <span className="field-label">Cover image (optional)</span><small>Text-only articles are welcome. Up to five images total.</small>
                  {canEdit && ["owner", "contributor"].includes(role) && (
                    <label className="upload-control">
                      <ImagePlus size={18} />
                      <span>{busy ? "Uploading..." : "Choose JPEG, PNG, WebP, or AVIF (5 MB source; 2 MB stored limit)"}</span>
                      <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={uploadCover} disabled={locked} />
                    </label>
                  )}
                  {role === "editor" && <small>Cover images are managed by the author or owner.</small>}
                  {canEdit && imageUrl && ["owner", "contributor"].includes(role) && <button type="button" className="secondary-button" disabled={locked} onClick={() => {updateField("coverImagePath", "");setImageUrl(null);}}>Remove cover</button>}
                  {imageUrl && (
                    <div className="cover-preview">
                      <Image src={imageUrl} alt="Article cover preview" width={720} height={300} unoptimized />
                    </div>
                  )}
                </div>
              </div>
            </div>



            {error && <p className="workspace-alert workspace-alert-error" role="alert">{error}</p>}
            {message && <p className="workspace-alert workspace-alert-success" role="status">{message}</p>}
            <div className="workspace-actions">
              {canEdit && (
                <button className="primary-button" type="button" onClick={saveArticle} disabled={locked}>
                  <Save size={16} /> {busy ? "Saving..." : isNew ? "Save draft" : "Save changes"}
                </button>
              )}
              {canSubmit && (
                <button className="secondary-button" type="button" onClick={() => changeWorkflow("submit")} disabled={locked}>
                  <Send size={16} /> Upload for review
                </button>
              )}
            </div>
          </section>

          <aside className="workspace-sidebar" id="editorial-controls">
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
                    {canStartReview && <button className="secondary-button" type="button" disabled={locked} onClick={() => changeWorkflow("start_review")}>Start review</button>}
                    {canRequestRevision && <button className="secondary-button" type="button" disabled={locked || !reviewNote.trim()} onClick={() => changeWorkflow("request_revision")}>Request revision</button>}
                    {canReject && <button className="danger-button" type="button" disabled={locked || !reviewNote.trim()} onClick={() => changeWorkflow("reject")}>Reject</button>}
                    {canApprove && <button className="primary-button" type="button" disabled={locked} onClick={() => changeWorkflow(role === "owner" ? "approve_publish" : "approve")}>{role === "owner" ? "Approve & publish" : "Approve for owner"}</button>}
                    {canPublish && <button className="primary-button" type="button" disabled={locked} onClick={() => changeWorkflow("publish")}>Publish article</button>}
                    {canUnpublish && <button className="secondary-button" type="button" disabled={locked} onClick={() => changeWorkflow("unpublish")}>Unpublish</button>}
                  </div>
                  {role !== "owner" && status === "approved" && <p className="permission-note">Owner approval is complete. Only the owner can publish this article.</p>}
                  {role === "owner" && (
                    <button className="danger-button delete-article-button" type="button" disabled={locked} onClick={deleteArticle}>
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
              {item.previous_status && <small>{formatStatus(item.previous_status)} → {formatStatus(item.new_status)}</small>}
              <time dateTime={item.created_at}>{formatDate(item.created_at)}</time>
            </article>
          ))}
          {revisions.map((revision) => (
            <details className="revision-item" key={`revision-${revision.id}`}>
              <summary>Revision {revision.revision_number}: {revision.title} <time dateTime={revision.created_at}>{formatDate(revision.created_at)}</time></summary>
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
