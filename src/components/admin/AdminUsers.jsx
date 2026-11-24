"use client";

import { useEffect, useState } from "react";

const roles = ["owner", "editor", "contributor", "reader"];

export default function AdminUsers({ currentUserId }) {
  const [users, setUsers] = useState([]);
  const [changes, setChanges] = useState({});
  const [invite, setInvite] = useState({ email: "", displayName: "", role: "reader" });
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    fetch("/api/admin/users").then(async (response) => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to load users.");
      setUsers(result.users);
    }).catch((requestError) => setError(requestError.message));
  }, []);

  function valueFor(user) {
    return changes[user.id] ?? { role: user.role, status: user.status };
  }

  async function inviteUser(event) {
    event.preventDefault();
    setBusyId("invite");
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invite),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to invite this account.");
      setUsers((current) => [{
        id: result.user.id,
        email: result.user.email,
        display_name: result.user.displayName,
        role: result.user.role,
        status: result.user.status,
      }, ...current]);
      setInvite({ email: "", displayName: "", role: "reader" });
      setNotice("Invitation sent.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyId("");
    }
  }

  async function saveUser(user) {
    setBusyId(user.id);
    setError("");
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(valueFor(user)),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to update this user.");
      setUsers((current) => current.map((item) => item.id === user.id ? { ...item, ...result.user } : item));
      setChanges((current) => ({ ...current, [user.id]: result.user }));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyId("");
    }
  }

  async function deleteUser(user) {
    if (!window.confirm(`Permanently delete the account for ${user.email ?? user.display_name}?`)) return;
    setBusyId(user.id);
    setError("");
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Unable to delete this account.");
      }
      setUsers((current) => current.filter((item) => item.id !== user.id));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyId("");
    }
  }

  return (
    <>
    <form className="portal-card admin-invite-form" onSubmit={inviteUser}>
      <h2>Invite an account</h2>
      <label>Email<input type="email" autoComplete="email" required maxLength={254} value={invite.email} onChange={(event) => setInvite((current) => ({ ...current, email: event.target.value }))} /></label>
      <label>Display name<input required maxLength={80} value={invite.displayName} onChange={(event) => setInvite((current) => ({ ...current, displayName: event.target.value }))} /></label>
      <label>Role<select value={invite.role} onChange={(event) => setInvite((current) => ({ ...current, role: event.target.value }))}>{roles.map((role) => <option value={role} key={role}>{role}</option>)}</select></label>
      <button className="primary-button" type="submit" disabled={busyId === "invite"}>{busyId === "invite" ? "Inviting..." : "Send invitation"}</button>
    </form>
    {notice && <p className="form-success" role="status">{notice}</p>}
    <section className="portal-card portal-table-card">
      {error && <p className="form-error" role="alert">{error}</p>}
      {!users.length && !error ? <p>Loading accounts…</p> : (
        <div className="portal-table-scroll">
          <table className="portal-table admin-user-table">
            <thead><tr><th>Account</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>{users.map((user) => {
              const value = valueFor(user);
              return (
                <tr key={user.id}>
                  <td>{user.display_name}<small>{user.email ?? "Email unavailable"}</small></td>
                  <td><select aria-label={`Role for ${user.display_name}`} value={value.role} onChange={(event) => setChanges((current) => ({ ...current, [user.id]: { ...value, role: event.target.value } }))}>{roles.map((role) => <option value={role} key={role}>{role}</option>)}</select></td>
                  <td><select aria-label={`Status for ${user.display_name}`} value={value.status} onChange={(event) => setChanges((current) => ({ ...current, [user.id]: { ...value, status: event.target.value } }))}><option value="active">active</option><option value="deactivated">deactivated</option></select></td>
                  <td className="admin-user-actions"><button type="button" className="secondary-button" disabled={busyId === user.id} onClick={() => saveUser(user)}>Save</button><button type="button" className="danger-button" disabled={busyId === user.id || user.id === currentUserId} onClick={() => deleteUser(user)}>Delete</button></td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      )}
    </section>
    </>
  );
}
