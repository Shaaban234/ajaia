"use client";
import { useEffect, useState } from "react";
import type { DocumentView, ShareRole, User } from "@/lib/types";

export default function ShareDialog({ doc, onClose, onChange }: { doc: DocumentView; onClose: () => void; onChange: (d: DocumentView) => void }) {
  const [users, setUsers] = useState<User[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ShareRole>("editor");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/users").then((r) => r.json()).then((b) => setUsers(b.users ?? []));
  }, []);

  const nameOf = (id: string) => users.find((u) => u.id === id);

  async function call(method: "POST" | "DELETE", body: object) {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/documents/${doc.id}/shares`, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) return setError(json.error ?? "Could not update sharing.");
    onChange(json.document);
    setEmail("");
  }

  const candidates = users.filter((u) => u.id !== doc.ownerId && !doc.shares.some((s) => s.userId === u.id));

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="card modal" role="dialog" aria-modal="true" aria-label="Share document" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Share “{doc.title}”</h2>
        <form onSubmit={(e) => { e.preventDefault(); call("POST", { email, role }); }} className="actions">
          <input className="input" style={{ flex: 1, minWidth: 180 }} placeholder="Email, e.g. bob@ajaia.test" value={email} onChange={(e) => setEmail(e.target.value)} list="share-users" />
          <datalist id="share-users">{candidates.map((u) => <option key={u.id} value={u.email}>{u.name}</option>)}</datalist>
          <select className="input" style={{ width: "auto" }} value={role} onChange={(e) => setRole(e.target.value as ShareRole)}>
            <option value="editor">Can edit</option>
            <option value="viewer">Can view</option>
          </select>
          <button className="btn btn-primary" disabled={busy || !email.trim()}>Share</button>
        </form>
        {error && <p className="error" role="alert">{error}</p>}

        <h3 className="section-title" style={{ marginTop: 18 }}>People with access</h3>
        <div>
          <div className="share-row">
            <span>{nameOf(doc.ownerId)?.name ?? doc.ownerId}</span><span className="spacer" /><span className="badge badge-owner">Owner</span>
          </div>
          {doc.shares.map((s) => (
            <div className="share-row" key={s.userId}>
              <span>{nameOf(s.userId)?.name ?? s.userId} <span className="muted">{nameOf(s.userId)?.email}</span></span>
              <span className="spacer" />
              <select className="input" style={{ width: "auto" }} value={s.role} disabled={busy}
                onChange={(e) => call("POST", { email: nameOf(s.userId)?.email, role: e.target.value })}>
                <option value="editor">Can edit</option>
                <option value="viewer">Can view</option>
              </select>
              <button className="btn btn-danger" disabled={busy} onClick={() => call("DELETE", { userId: s.userId })}>Remove</button>
            </div>
          ))}
        </div>
        <div className="actions" style={{ justifyContent: "flex-end", marginTop: 16 }}>
          <button className="btn" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
