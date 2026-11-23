"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { CharacterCount, Placeholder } from "@tiptap/extensions";
import TopBar from "./TopBar";
import Toolbar from "./Toolbar";
import ShareDialog from "./ShareDialog";
import Avatar from "./Avatar";
import { useToast } from "./Toasts";
import { IconAlert, IconArrowLeft, IconCheck, IconCrown, IconDownload, IconEye, IconPen, IconShare, IconTrash } from "./Icons";
import { relativeTime } from "@/lib/ui";
import type { DocumentView, User } from "@/lib/types";

type SaveState = "saved" | "dirty" | "saving" | "error";
const AUTOSAVE_MS = 800;
const NAMES: Record<string, string> = { u_alice: "Alice Khan", u_bob: "Bob Martin", u_carol: "Carol Diaz" };

function SavePill({ state, onRetry }: { state: SaveState; onRetry: () => void }) {
  if (state === "saved") return <span className="save-pill saved" aria-live="polite"><IconCheck />Saved</span>;
  if (state === "saving") return <span className="save-pill saving" aria-live="polite"><span className="dot" />Saving…</span>;
  if (state === "error") return <button className="save-pill error" onClick={onRetry} style={{ border: "none", cursor: "pointer" }}><span className="dot" />Save failed · Retry</button>;
  return <span className="save-pill" aria-live="polite"><span className="dot" />Unsaved</span>;
}

export default function DocumentEditor({ user, id }: { user: User; id: string }) {
  const router = useRouter();
  const toast = useToast();
  const [doc, setDoc] = useState<DocumentView | null>(null);
  const [loadError, setLoadError] = useState("");
  const [title, setTitle] = useState("");
  const [save, setSave] = useState<SaveState>("saved");
  const [shareOpen, setShareOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<string | null>(null);
  const lastSaved = useRef<string>("");
  const editable = useRef(false);

  const canEdit = doc?.role === "owner" || doc?.role === "editor";
  const isOwner = doc?.role === "owner";

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    const html = pending.current;
    if (html === null) return;
    pending.current = null;
    setSave("saving");
    try {
      const res = await fetch(`/api/documents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: html }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      lastSaved.current = html;
      const body = await res.json().catch(() => null);
      if (body?.document) setDoc((d) => (d ? { ...d, updatedAt: body.document.updatedAt } : d));
      // Only mark saved if nothing new was typed while the request was in flight.
      setSave(pending.current === null ? "saved" : "dirty");
    } catch {
      pending.current ??= html; // keep the unsaved content for retry
      setSave("error");
    }
  }, [id]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: { openOnClick: false } }),
      Placeholder.configure({ placeholder: "Start writing, or use the toolbar to add a heading…" }),
      CharacterCount,
    ],
    content: "",
    editable: false,
    immediatelyRender: false,
    onUpdate: ({ editor: e }) => {
      if (!editable.current) return;
      const html = e.getHTML();
      // TipTap can emit no-op updates (e.g. when toggling editability); ignore them.
      if (html === lastSaved.current) {
        pending.current = null;
        if (timer.current) clearTimeout(timer.current);
        return setSave("saved");
      }
      pending.current = html;
      setSave("dirty");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, AUTOSAVE_MS);
    },
  });

  const counts = useEditorState({
    editor,
    selector: ({ editor: e }) => (e ? { words: e.storage.characterCount.words() as number, chars: e.storage.characterCount.characters() as number } : { words: 0, chars: 0 }),
  });

  // Load the document once the editor exists.
  useEffect(() => {
    if (!editor) return;
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/documents/${id}`, { cache: "no-store" });
      if (cancelled) return;
      if (res.status === 401) return router.push("/login");
      if (!res.ok) return setLoadError((await res.json()).error ?? "Could not open document.");
      const d: DocumentView = (await res.json()).document;
      setDoc(d);
      setTitle(d.title);
      editor.commands.setContent(d.content, { emitUpdate: false });
      lastSaved.current = editor.getHTML(); // normalized form, so the first keystroke is the first real change
      editable.current = d.role !== "viewer";
      editor.setEditable(editable.current, false);
      if (editable.current && editor.isEmpty) editor.commands.focus("end");
    })();
    return () => { cancelled = true; };
  }, [editor, id, router]);

  // Ctrl/Cmd+S saves immediately; warn before leaving with unsaved changes; flush on unmount.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (pending.current !== null) { e.preventDefault(); e.returnValue = ""; }
    };
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); flush(); }
    };
    window.addEventListener("beforeunload", warn);
    window.addEventListener("keydown", key);
    return () => { window.removeEventListener("beforeunload", warn); window.removeEventListener("keydown", key); flush(); };
  }, [flush]);

  async function rename() {
    if (!doc || !isOwner) return;
    const next = title.trim();
    if (next === doc.title) return;
    if (!next) { setTitle(doc.title); return toast("error", "Title cannot be empty."); }
    const res = await fetch(`/api/documents/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: next }),
    });
    const body = await res.json();
    if (!res.ok) { setTitle(doc.title); return toast("error", body.error ?? "Rename failed."); }
    setDoc({ ...doc, title: body.document.title });
    setTitle(body.document.title);
    toast("success", "Renamed");
  }

  async function remove() {
    if (!confirm("Delete this document for everyone? This cannot be undone.")) return;
    const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
    if (!res.ok) return toast("error", (await res.json()).error ?? "Delete failed.");
    pending.current = null;
    toast("success", "Document deleted");
    router.push("/");
  }

  if (loadError) {
    return (
      <>
        <TopBar user={user} />
        <main className="page">
          <div className="empty anim-fade-up" style={{ maxWidth: 520, margin: "60px auto" }}>
            <div className="empty-icon"><IconAlert /></div>
            <div style={{ flex: 1 }}>
              <strong style={{ display: "block", color: "var(--text)" }}>{loadError}</strong>
              <span className="muted">It may have been deleted, or you don&apos;t have access.</span>
            </div>
            <Link href="/" className="btn">Back</Link>
          </div>
        </main>
      </>
    );
  }

  const people = doc ? [doc.ownerId, ...doc.shares.map((s) => s.userId)] : [];

  return (
    <>
      <TopBar
        user={user}
        right={doc && (
          <>
            {canEdit && <SavePill state={save} onRetry={flush} />}
            <span className="avatar-stack hide-sm" title={`People with access: ${people.map((p) => NAMES[p]).join(", ")}`}>
              {people.slice(0, 4).map((p) => <Avatar key={p} name={NAMES[p] ?? "?"} id={p} />)}
            </span>
            {isOwner && <button className="btn btn-primary btn-sm" onClick={() => setShareOpen(true)}><IconShare />Share</button>}
          </>
        )}
      >
        <div className="title-wrap">
          <Link href="/" className="btn btn-ghost btn-sm" aria-label="Back to documents" title="All documents"><IconArrowLeft /></Link>
          {doc && (
            <>
              <input
                className="title-input"
                value={title}
                disabled={!isOwner}
                title={isOwner ? "Click to rename" : "Only the owner can rename"}
                aria-label="Document title"
                maxLength={120}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={rename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  if (e.key === "Escape") { setTitle(doc.title); (e.target as HTMLInputElement).blur(); }
                }}
              />
              <span className={`badge hide-sm ${isOwner ? "badge-owner" : doc.role === "editor" ? "badge-edit" : "badge-view"}`}>
                {isOwner ? <><IconCrown />Owner</> : doc.role === "editor" ? <><IconPen />Can edit</> : <><IconEye />View only</>}
              </span>
            </>
          )}
        </div>
      </TopBar>

      <main className="editor-page">
        {doc && !canEdit && (
          <div className="readonly-banner">
            <IconEye />
            <span><strong>View only.</strong> {NAMES[doc.ownerId] ?? "The owner"} shared this with you as a viewer. Ask them for edit access to make changes.</span>
          </div>
        )}
        {doc && canEdit && editor && <Toolbar editor={editor} />}
        {!doc && <div className="loading-sheet" />}
        <div className="sheet" style={{ display: doc ? "block" : "none" }}>
          <EditorContent editor={editor} />
        </div>
        {doc && (
          <div className="sheet-footer">
            <span>{counts?.words ?? 0} words · {counts?.chars ?? 0} characters</span>
            <span>Edited {relativeTime(doc.updatedAt)}</span>
            <a href={`/api/documents/${id}/export`} className="btn btn-ghost btn-sm"><IconDownload />Export .md</a>
            {isOwner && <button className="btn btn-ghost btn-sm btn-danger" onClick={remove}><IconTrash />Delete</button>}
          </div>
        )}
      </main>

      {shareOpen && doc && <ShareDialog doc={doc} onClose={() => setShareOpen(false)} onChange={setDoc} />}
    </>
  );
}
