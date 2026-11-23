"use client";
import { useEffect, useRef, useState } from "react";
import Avatar from "./Avatar";
import { useToast } from "./Toasts";
import { IconAlert, IconShare, IconX } from "./Icons";
import type { DocumentView, ShareRole, User } from "@/lib/types";

export default function ShareDialog({ doc, onClose, onChange }: { doc: DocumentView; onClose: () => void; onChange: (d: DocumentView) => void }) {
  const toast = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ShareRole>("editor");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    fetch("/api/users").then((r) => r.json()).then((b) => setUsers(b.users ?? []));
    inputRef.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, []);

  const userById = (id: string) => users.find((u) => u.id === id);

  async function call(method: "POST" | "DELETE", body: object, success: string) {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/documents/${doc.id}/shares`, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) return setError(json.error ?? "Could not update sharing.");
    onChange(json.document);
    setEmail("");
    toast("success", success);
  }

  const candidates = users.filter((u) => u.id !== doc.ownerId && !doc.shares.some((s) => s.userId === u.id));
  const owner = userById(doc.ownerId);

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="share-title" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-icon"><IconShare /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 id="share-title">Share “{doc.title}”</h2>
            <p className="muted">Editors can change content. Viewers can only read. Only you can rename, delete or reshare.</p>
          </div>
          <button className="icon-btn" style={{ color: "var(--muted)" }} onClick={onClose} aria-label="Close"><IconX /></button>
        </div>

        <div className="modal-body">
          <form className="share-form" onSubmit={(e) => { e.preventDefault(); const name = users.find((u) => u.email === email.trim().toLowerCase())?.name ?? email; call("POST", { email, role }, `Shared with ${name}`); }}>
            <input ref={inputRef} className="input" placeholder="Add people by email" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email to share with" />
            <select className="select" value={role} onChange={(e) => setRole(e.target.value as ShareRole)} aria-label="Access level">
              <option value="editor">Can edit</option>
              <option value="viewer">Can view</option>
            </select>
            <button className="btn btn-primary" disabled={busy || !email.trim()}>{busy ? <span className="spinner" /> : "Share"}</button>
          </form>

          {candidates.length > 0 && (
            <div className="suggestions">
              <span className="muted" style={{ alignSelf: "center" }}>Suggested:</span>
              {candidates.map((u) => (
                <button key={u.id} type="button" className="suggestion" onClick={() => { setEmail(u.email); inputRef.current?.focus(); }}>
                  <Avatar name={u.name} id={u.id} />{u.name}
                </button>
              ))}
            </div>
          )}

          {error && <div className="error-box" role="alert" style={{ marginTop: 12 }}><IconAlert width={16} />{error}</div>}

          <div className="people">
            <p className="people-title">People with access</p>
            <div className="person">
              <Avatar name={owner?.name ?? "?"} id={doc.ownerId} size="lg" />
              <div className="who"><strong>{owner?.name ?? doc.ownerId} {doc.role === "owner" && <span className="muted">(you)</span>}</strong><span>{owner?.email}</span></div>
              <span className="badge badge-owner">Owner</span>
            </div>
            {doc.shares.map((s) => {
              const u = userById(s.userId);
              return (
                <div className="person" key={s.userId}>
                  <Avatar name={u?.name ?? "?"} id={s.userId} size="lg" />
                  <div className="who"><strong>{u?.name ?? s.userId}</strong><span>{u?.email}</span></div>
                  <select className="select" value={s.role} disabled={busy} aria-label={`Access for ${u?.name}`}
                    onChange={(e) => call("POST", { email: u?.email, role: e.target.value }, `${u?.name} can now ${e.target.value === "editor" ? "edit" : "view"}`)}>
                    <option value="editor">Can edit</option>
                    <option value="viewer">Can view</option>
                  </select>
                  <button className="icon-btn" disabled={busy} title="Remove access" aria-label={`Remove ${u?.name}`} onClick={() => call("DELETE", { userId: s.userId }, `Removed ${u?.name}`)}><IconX /></button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="modal-foot">
          <span className="muted">{doc.shares.length === 0 ? "Only you can open this document" : `${doc.shares.length + 1} people have access`}</span>
          <button className="btn" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
