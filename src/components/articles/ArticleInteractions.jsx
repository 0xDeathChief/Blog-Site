"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bookmark, Heart, MessageCircle } from "lucide-react";

export default function ArticleInteractions({ articleId, articlePath, isReader, comments }) {
  const [bookmarked, setBookmarked] = useState(false);
  const [liked, setLiked] = useState(false);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!isReader) return;
    fetch(`/api/reader/activity?articleId=${encodeURIComponent(articleId)}`)
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Unable to load your saved article activity.");
        setBookmarked(result.bookmarked);
        setLiked(result.liked);
      })
      .catch((requestError) => setError(requestError.message));
    fetch("/api/reader/activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "read", articleId }),
    }).then(async (response) => {
      if (!response.ok) {
        const result = await response.json();
        setError(result.error || "Unable to update your reading history.");
      }
    }).catch(() => setError("Unable to update your reading history."));
  }, [articleId, isReader]);

  async function toggle(action, current, update) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = current
        ? await fetch("/api/reader/activity", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, articleId }),
        })
        : await fetch("/api/reader/activity", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, articleId }),
        });
      const result = response.status === 204 ? {} : await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to save this activity.");
      update(!current);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitComment(event) {
    event.preventDefault();
    if (!comment.trim()) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/reader/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "comment", articleId, body: comment }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to post your comment.");
      setComment("");
      setNotice("Comment posted.");
      window.location.reload();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="article-interactions" aria-label="Article engagement">
      {isReader ? (
        <div className="article-interaction-actions">
          <button type="button" disabled={busy} aria-pressed={bookmarked} onClick={() => toggle("bookmark", bookmarked, setBookmarked)}><Bookmark size={16} /> {bookmarked ? "Bookmarked" : "Bookmark"}</button>
          <button type="button" disabled={busy} aria-pressed={liked} onClick={() => toggle("like", liked, setLiked)}><Heart size={16} /> {liked ? "Liked" : "Like"}</button>
        </div>
      ) : <p><Link href={`/sign-in?next=${encodeURIComponent(articlePath)}`}>Sign in as a reader</Link> to bookmark, like, or comment.</p>}
      <div className="article-comments">
        <h2><MessageCircle size={18} /> Reader comments <span>{comments.length}</span></h2>
        {comments.length
          ? <ol>{comments.map((item) => <li key={item.id}><p>{item.body}</p><time dateTime={item.created_at}>{formatDate(item.created_at)}</time></li>)}</ol>
          : <p className="muted-copy">No comments yet.</p>}
        {isReader && (
          <form onSubmit={submitComment}>
            <label htmlFor="article-comment">Add a comment</label>
            <textarea id="article-comment" rows={3} maxLength={2000} value={comment} onChange={(event) => setComment(event.target.value)} required placeholder="Keep it constructive and relevant." />
            <button className="secondary-button" type="submit" disabled={busy || !comment.trim()}>Post comment</button>
          </form>
        )}
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {notice && <p className="form-success" role="status">{notice}</p>}
    </section>
  );
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
}
