"use client";

import { useEffect, useState } from "react";

export default function AdminCatalog({ kind }) {
  const [items, setItems] = useState([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const isCategory = kind === "categories";

  useEffect(() => {
    let active = true;
    fetch(`/api/admin/catalog/${kind}`).then(async (response) => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to load catalog.");
      if (active) setItems(result.items);
    }).catch((loadError) => {
      if (active) setError(loadError.message);
    });
    return () => {
      active = false;
    };
  }, [kind]);

  async function request(url, method, body) {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = response.status === 204 ? {} : await response.json();
    if (!response.ok) throw new Error(result.error || "Unable to update this item.");
    return result;
  }

  async function addItem(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const { item } = await request(`/api/admin/catalog/${kind}`, "POST", { name, slug });
      setItems((current) => [...current, item].sort((a, b) => a.name.localeCompare(b.name)));
      setName("");
      setSlug("");
      setNotice("Item created.");
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleCategory(item) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const { item: updated } = await request(`/api/admin/catalog/${kind}`, "PATCH", {
        id: item.id,
        name: item.name,
        slug: item.slug,
        isActive: !item.is_active,
      });
      setItems((current) => current.map((row) => row.id === item.id ? updated : row));
      setNotice("Category visibility updated.");
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveItem(item) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const { item: updated } = await request(`/api/admin/catalog/${kind}`, "PATCH", {
        id: item.id,
        name: item.name,
        slug: item.slug,
        ...(isCategory ? { isActive: item.is_active } : {}),
      });
      setItems((current) => current.map((row) => row.id === item.id ? updated : row));
      setNotice("Item updated.");
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setBusy(false);
    }
  }

  async function removeItem(item) {
    const warning = isCategory
      ? "Delete this category? Articles using it will become uncategorized."
      : "Delete this tag? It will be removed from articles that use it.";
    if (!window.confirm(warning)) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await request(`/api/admin/catalog/${kind}`, "DELETE", { id: item.id });
      setItems((current) => current.filter((row) => row.id !== item.id));
      setNotice("Item deleted.");
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-catalog-layout">
      <form className="portal-card portal-form" onSubmit={addItem}>
        <h2>Add {isCategory ? "category" : "tag"}</h2>
        <label>Name<input value={name} onChange={(event) => setName(event.target.value)} maxLength={isCategory ? 80 : 40} required /></label>
        <label>URL slug<input value={slug} onChange={(event) => setSlug(event.target.value)} maxLength={160} pattern="[a-z0-9]+(-[a-z0-9]+)*" required /></label>
        <button className="primary-button" type="submit" disabled={busy}>Add {isCategory ? "category" : "tag"}</button>
      </form>
      <section className="portal-card admin-catalog-list">
        <h2>Existing {kind}</h2>
        {items.map((item) => (
          <article key={item.id}>
            <label>Name<input value={item.name} onChange={(event) => setItems((current) => current.map((row) => row.id === item.id ? { ...row, name: event.target.value } : row))} maxLength={isCategory ? 80 : 40} /></label>
            <label>Slug<input value={item.slug} onChange={(event) => setItems((current) => current.map((row) => row.id === item.id ? { ...row, slug: event.target.value } : row))} maxLength={160} pattern="[a-z0-9]+(-[a-z0-9]+)*" /></label>
            <button className="secondary-button" type="button" disabled={busy} onClick={() => saveItem(item)}>Save</button>
            {isCategory && <button className="secondary-button" type="button" disabled={busy} onClick={() => toggleCategory(item)}>{item.is_active ? "Deactivate" : "Activate"}</button>}
            <button className="danger-button" type="button" disabled={busy} onClick={() => removeItem(item)}>Delete</button>
          </article>
        ))}
        {!items.length && <p>No {kind} configured yet.</p>}
      </section>
      {error && <p className="form-error" role="alert">{error}</p>}
      {notice && <p className="form-success" role="status">{notice}</p>}
    </div>
  );
}
