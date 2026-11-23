"use client";
import { useEffect, useRef, useState } from "react";
import Avatar from "./Avatar";
import Popover from "./Popover";
import { useToast } from "./Toasts";
import { IconAlert, IconCaret, IconCheck, IconLink, IconLock, IconUsers } from "./Icons";
import type { DocumentView, LinkAccess, ShareRole, User } from "@/lib/types";

const LINK_OPTIONS: { v: LinkAccess; label: string; desc: string }[] = [
  { v: "restricted", label: "Restricted", desc: "Only people with access can open with the link" },
  { v: "viewer", label: "Anyone with the link · Viewer", desc: "Anyone signed in with the link can view" },
  { v: "editor", label: "Anyone with the link · Editor", desc: "Anyone signed in with the link can edit" },
];

export default function ShareDialog({ doc, onClose, onChange }: { doc: DocumentView; onClose: () => void; onChange: (d: DocumentView) => void }) {
  const toast = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ShareRole>("editor");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [focused, setFocused] = useState(true);
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
  const isOwner = doc.role === "owner";
  const link = doc.linkAccess ?? "restricted";

  async function share(method: "POST" | "DELETE", body: object, success: string) {
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

  async function setLink(v: LinkAccess) {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/documents/${doc.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ linkAccess: v }) });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) return setError(json.error ?? "Could not change general access.");
    onChange({ ...doc, linkAccess: json.document.linkAccess });
    toast("success", v === "restricted" ? "Access restricted to people added" : `Anyone with the link can now ${v === "editor" ? "edit" : "view"}`);
  }

  async function copyLink() {
    const url = `${window.location.origin}/docs/${doc.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast("success", "Link copied");
    } catch {
      window.prompt("Copy this link:", url);
    }
  }

  const query = email.trim().toLowerCase();
  const candidates = users.filter((u) => u.id !== doc.ownerId && !doc.shares.some((s) => s.userId === u.id)
    && (!query || u.email.includes(query) || u.name.toLowerCase().includes(query)));
  const exact = users.find((u) => u.email === query);
  const linkOpt = LINK_OPTIONS.find((o) => o.v === link)!;

  function submit(e?: React.FormEvent, overrideEmail?: string) {
    e?.preventDefault();
    const em = overrideEmail ?? email;
    if (!em.trim()) return;
    const name = users.find((u) => u.email === em.trim().toLowerCase())?.name ?? em;
    share("POST", { email: em, role }, `Shared with ${name}`);
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="gshare" role="dialog" aria-modal="true" aria-labelledby="share-title" onMouseDown={(e) => e.stopPropagation()}>
        <h2 id="share-title" className="gshare-title">Share “{doc.title}”</h2>

        <form onSubmit={submit} className="gshare-add">
          <div className={`gfield ${focused ? "focused" : ""} ${email ? "filled" : ""}`}>
            <label htmlFor="share-email">Add people by email</label>
            <input id="share-email" ref={inputRef} value={email} autoComplete="off"
              onFocus={() => setFocused(true)} onBlur={() => setTimeout(() => setFocused(false), 150)}
              onChange={(e) => setEmail(e.target.value)} />
            {email && (
              <select className="gfield-role" value={role} onChange={(e) => setRole(e.target.value as ShareRole)} aria-label="Access level">
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
            )}
          </div>
          {focused && candidates.length > 0 && !exact && (
            <div className="gsuggest">
              {candidates.map((u) => (
                <button key={u.id} type="button" className="gsuggest-item" onMouseDown={(e) => e.preventDefault()} onClick={() => { setEmail(u.email); inputRef.current?.focus(); }}>
                  <Avatar name={u.name} id={u.id} />
                  <span><strong>{u.name}</strong><small>{u.email}</small></span>
                </button>
              ))}
            </div>
          )}
          {email && <div className="gshare-send"><button className="btn btn-primary" disabled={busy}>{busy ? <span className="spinner" /> : "Share"}</button></div>}
        </form>

        {error && <div className="error-box" role="alert" style={{ margin: "0 0 12px" }}><IconAlert width={16} />{error}</div>}

        <h3 className="gshare-sub">People with access</h3>
        <div className="gpeople">
          {[{ userId: doc.ownerId, role: "owner" as const }, ...doc.shares].map((s) => {
            const u = userById(s.userId);
            const me = doc.role === "owner" && s.role === "owner";
            return (
              <div className="gperson" key={s.userId}>
                <Avatar name={u?.name ?? "?"} id={s.userId} size="lg" />
                <div className="who"><strong>{u?.name ?? s.userId}{me && " (you)"}</strong><span>{u?.email}</span></div>
                {s.role === "owner" ? (
                  <span className="gowner">Owner</span>
                ) : (
                  <Popover tip="Change access" align="right" className="grole" disabled={!isOwner || busy}
                    trigger={<span>{s.role === "editor" ? "Editor" : "Viewer"}<IconCaret className="caret" /></span>}>
                    {(close) => (
                      <>
                        {(["viewer", "editor"] as const).map((r) => (
                          <button key={r} type="button" className="pop-item" onClick={() => { close(); if (r !== s.role) share("POST", { email: u?.email, role: r }, `${u?.name} is now ${r === "editor" ? "an editor" : "a viewer"}`); }}>
                            {s.role === r ? <IconCheck width={15} /> : <span style={{ width: 15 }} />}{r === "editor" ? "Editor" : "Viewer"}
                          </button>
                        ))}
                        <div className="menu-div" />
                        <button type="button" className="pop-item danger" onClick={() => { close(); share("DELETE", { userId: s.userId }, `Removed ${u?.name}`); }}>Remove access</button>
                      </>
                    )}
                  </Popover>
                )}
              </div>
            );
          })}
        </div>

        <h3 className="gshare-sub">General access</h3>
        <div className="ggeneral">
          <span className={`ggeneral-icon ${link === "restricted" ? "" : "open"}`}>{link === "restricted" ? <IconLock /> : <IconUsers />}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Popover tip="Change general access" className="glink" disabled={!isOwner || busy}
              trigger={<span>{link === "restricted" ? "Restricted" : "Anyone with the link"}<IconCaret className="caret" /></span>}>
              {(close) => LINK_OPTIONS.map((o) => (
                <button key={o.v} type="button" className="pop-item tall" onClick={() => { close(); if (o.v !== link) setLink(o.v); }}>
                  {o.v === link ? <IconCheck width={16} /> : <span style={{ width: 16 }} />}
                  <span><strong>{o.label}</strong><small>{o.desc}</small></span>
                </button>
              ))}
            </Popover>
            <p className="ggeneral-desc">{linkOpt.desc}</p>
          </div>
          {link !== "restricted" && <span className="gowner">{link === "editor" ? "Editor" : "Viewer"}</span>}
        </div>

        <div className="gshare-foot">
          <button type="button" className="gbtn-outline" onClick={copyLink}><IconLink />Copy link</button>
          <button type="button" className="gbtn-done" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
