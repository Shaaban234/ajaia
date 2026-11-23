"use client";
import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import Avatar from "./Avatar";
import { useToast } from "./Toasts";
import { IconCheck, IconComment, IconTrash, IconX } from "./Icons";
import { commentOrder, removeCommentMark } from "@/lib/commentMark";
import { relativeTime } from "@/lib/ui";
import type { Comment, DocumentView, User } from "@/lib/types";

const NAMES: Record<string, string> = { u_alice: "Alice Khan", u_bob: "Bob Martin", u_carol: "Carol Diaz" };

export type PendingComment = { id: string; from: number; to: number; quote: string };

export default function CommentsPanel({
  editor, doc, user, pending, onPendingDone, activeId, onActivate, onClose, onCount,
}: {
  editor: Editor; doc: DocumentView; user: User;
  pending: PendingComment | null; onPendingDone: () => void;
  activeId: string | null; onActivate: (id: string | null) => void;
  onClose: () => void; onCount: (n: number) => void;
}) {
  const toast = useToast();
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [draft, setDraft] = useState("");
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const newRef = useRef<HTMLTextAreaElement>(null);
  const canEdit = doc.role === "owner" || doc.role === "editor";

  async function load() {
    const res = await fetch(`/api/documents/${doc.id}/comments`, { cache: "no-store" });
    if (res.ok) setComments((await res.json()).comments);
  }
  useEffect(() => { load(); }, [doc.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (pending) setTimeout(() => newRef.current?.focus(), 50); }, [pending]);

  const roots = (comments ?? []).filter((c) => c.threadId === null);
  const open = roots.filter((c) => !c.resolved);
  useEffect(() => { onCount(open.length); }, [open.length, onCount]);

  const order = commentOrder(editor);
  const sortByDoc = (a: Comment, b: Comment) => {
    const ia = order.indexOf(a.id), ib = order.indexOf(b.id);
    return (ia === -1 ? 1e9 : ia) - (ib === -1 ? 1e9 : ib) || a.createdAt.localeCompare(b.createdAt);
  };
  const visible = (showResolved ? roots : open).slice().sort(sortByDoc);

  async function api(path: string, method: string, body?: object) {
    setBusy(true);
    const res = await fetch(`/api/documents/${doc.id}/comments${path}`, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { toast("error", json.error ?? "Something went wrong."); return null; }
    return json;
  }

  async function createThread() {
    if (!pending || !draft.trim()) return;
    const json = await api("", "POST", { id: pending.id, body: draft, quote: pending.quote });
    if (!json) return;
    // Anchor the thread in the document; the editor autosaves this like any edit.
    editor.chain().setTextSelection({ from: pending.from, to: pending.to }).setMark("comment", { commentId: pending.id }).setTextSelection(pending.to).run();
    setComments((c) => [...(c ?? []), json.comment]);
    setDraft("");
    onPendingDone();
    onActivate(pending.id);
    toast("success", "Comment added");
  }

  async function reply(threadId: string) {
    const text = replies[threadId]?.trim();
    if (!text) return;
    const json = await api("", "POST", { body: text, threadId });
    if (!json) return;
    setComments((c) => [...(c ?? []), json.comment]);
    setReplies((r) => ({ ...r, [threadId]: "" }));
  }

  async function resolve(c: Comment, resolved: boolean) {
    const json = await api(`/${c.id}`, "PATCH", { resolved });
    if (!json) return;
    setComments((cs) => (cs ?? []).map((x) => (x.id === c.id ? json.comment : x)));
    if (resolved) { removeCommentMark(editor, c.id); onActivate(null); toast("success", "Comment resolved"); }
  }

  async function remove(c: Comment) {
    if (!(await api(`/${c.id}`, "DELETE"))) return;
    setComments((cs) => (cs ?? []).filter((x) => x.id !== c.id && x.threadId !== c.id));
    if (c.threadId === null && canEdit) removeCommentMark(editor, c.id);
  }

  function focusThread(id: string) {
    onActivate(id);
    const el = editor.view.dom.querySelector(`[data-comment-id="${id}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <aside className="comments-panel" aria-label="Comments">
      <div className="cp-head">
        <IconComment width={18} />
        <strong>Comments</strong>
        <span className="count">{open.length}</span>
        <span className="spacer" />
        {roots.some((r) => r.resolved) && (
          <button className="cp-link" onClick={() => setShowResolved((s) => !s)}>{showResolved ? "Hide resolved" : "Show resolved"}</button>
        )}
        <button className="icon-btn plain" onClick={onClose} aria-label="Close comments"><IconX /></button>
      </div>

      {pending && (
        <div className="thread active new">
          <div className="thread-quote">“{pending.quote.length > 120 ? pending.quote.slice(0, 120) + "…" : pending.quote}”</div>
          <div className="c-author"><span className="avatar-sm"><Avatar name={user.name} id={user.id} /></span><strong>{user.name}</strong></div>
          <textarea ref={newRef} className="c-input" rows={3} placeholder="Add a comment…" value={draft} maxLength={2000}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) createThread(); if (e.key === "Escape") { setDraft(""); onPendingDone(); } }} />
          <div className="c-actions">
            <button className="btn btn-sm btn-ghost" onClick={() => { setDraft(""); onPendingDone(); }}>Cancel</button>
            <button className="btn btn-sm btn-primary" disabled={busy || !draft.trim()} onClick={createThread}>Comment</button>
          </div>
        </div>
      )}

      {comments === null ? (
        <div className="cp-empty"><span className="spinner" /></div>
      ) : visible.length === 0 && !pending ? (
        <div className="cp-empty">
          <IconComment width={28} />
          <p>No open comments</p>
          <span className="muted">{canEdit ? "Select text and click the comment button (Ctrl+Alt+M) to start a discussion." : "Comments on this document will appear here."}</span>
        </div>
      ) : (
        <div className="threads">
          {visible.map((root) => {
            const thread = [root, ...(comments ?? []).filter((c) => c.threadId === root.id)];
            const isActive = activeId === root.id;
            return (
              <div key={root.id} className={`thread ${isActive ? "active" : ""} ${root.resolved ? "resolved" : ""}`} onClick={() => !isActive && focusThread(root.id)}>
                <div className="thread-quote">“{root.quote.length > 120 ? root.quote.slice(0, 120) + "…" : root.quote}”</div>
                {thread.map((c) => (
                  <div key={c.id} className="c-item">
                    <div className="c-author">
                      <span className="avatar-sm"><Avatar name={NAMES[c.authorId] ?? "?"} id={c.authorId} /></span>
                      <div style={{ flex: 1, minWidth: 0 }}><strong>{NAMES[c.authorId] ?? c.authorId}</strong><span className="c-time">{relativeTime(c.createdAt)}</span></div>
                      {c === root && canEdit && !root.resolved && (
                        <button className="icon-btn plain resolve" title="Mark as resolved and hide" aria-label="Resolve" onClick={(e) => { e.stopPropagation(); resolve(root, true); }}><IconCheck /></button>
                      )}
                      {c === root && canEdit && root.resolved && (
                        <button className="cp-link" onClick={(e) => { e.stopPropagation(); resolve(root, false); }}>Reopen</button>
                      )}
                      {(c.authorId === user.id || doc.role === "owner") && (
                        <button className="icon-btn" title="Delete" aria-label="Delete comment" onClick={(e) => { e.stopPropagation(); remove(c); }}><IconTrash /></button>
                      )}
                    </div>
                    <p className="c-body">{c.body}</p>
                  </div>
                ))}
                {isActive && !root.resolved && (
                  <div className="c-reply" onClick={(e) => e.stopPropagation()}>
                    <textarea className="c-input" rows={1} placeholder="Reply…" value={replies[root.id] ?? ""} maxLength={2000}
                      onChange={(e) => setReplies((r) => ({ ...r, [root.id]: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); reply(root.id); } }} />
                    {(replies[root.id] ?? "").trim() && (
                      <div className="c-actions">
                        <button className="btn btn-sm btn-ghost" onClick={() => setReplies((r) => ({ ...r, [root.id]: "" }))}>Cancel</button>
                        <button className="btn btn-sm btn-primary" disabled={busy} onClick={() => reply(root.id)}>Reply</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </aside>
  );
}
