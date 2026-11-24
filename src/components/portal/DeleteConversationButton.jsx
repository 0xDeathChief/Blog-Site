"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteConversationButton({ conversationId }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function remove() {
    if (!window.confirm("Permanently delete this saved conversation?")) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/reader/conversations/${conversationId}`, { method: "DELETE" });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Unable to delete this conversation.");
      }
      router.replace("/ai-conversations");
      router.refresh();
    } catch (requestError) {
      setError(requestError.message);
      setBusy(false);
    }
  }

  return (
    <div className="conversation-delete-control">
      <button className="danger-button" type="button" onClick={remove} disabled={busy}>{busy ? "Deleting..." : "Delete conversation"}</button>
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  );
}
