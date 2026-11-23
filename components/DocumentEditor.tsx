"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TopBar from "./TopBar";
import Toolbar from "./Toolbar";
import ShareDialog from "./ShareDialog";
import type { DocumentView, User } from "@/lib/types";

type SaveState = "saved" | "dirty" | "saving" | "error";
const AUTOSAVE_MS = 800;

export default function DocumentEditor({ user, id }: { user: User; id: string }) {
  const router = useRouter();
  const [doc, setDoc] = useState<DocumentView | null>(null);
  const [loadError, setLoadError] = useState("");
  const [title, setTitle] = useState("");
  const [titleError, setTitleError] = useState("");
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
      // Only mark saved if nothing new was typed while the request was in flight.
      setSave(pending.current === null ? "saved" : "dirty");
    } catch {
      pending.current ??= html; // keep the unsaved content for retry
      setSave("error");
    }
  }, [id]);

  const editor = useEditor({
    extensions: [StarterKit.configure({ link: { openOnClick: false } })],
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
    })();
    return () => { cancelled = true; };
  }, [editor, id, router]);

  // Warn before leaving with unsaved changes; flush on unmount.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (pending.current !== null) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", warn);
    return () => { window.removeEventListener("beforeunload", warn); flush(); };
  }, [flush]);

  async function rename() {
    if (!doc || !isOwner) return;
    const next = title.trim();
    if (next === doc.title) return;
    if (!next) { setTitle(doc.title); return setTitleError("Title cannot be empty."); }
    setTitleError("");
    const res = await fetch(`/api/documents/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: next }),
    });
    const body = await res.json();
    if (!res.ok) { setTitle(doc.title); return setTitleError(body.error ?? "Rename failed."); }
    setDoc({ ...doc, title: body.document.title });
    setTitle(body.document.title);
  }

  async function remove() {
    if (!confirm("Delete this document? This cannot be undone.")) return;
    const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
    if (res.ok) router.push("/");
    else alert((await res.json()).error ?? "Delete failed.");
  }

  const statusText = { saved: "All changes saved", dirty: "Unsaved changes", saving: "Saving…", error: "Save failed" }[save];

  if (loadError) {
    return (
      <>
        <TopBar user={user} />
        <main className="page"><div className="card"><p className="error">{loadError}</p><a href="/" className="btn">Back to documents</a></div></main>
      </>
    );
  }

  return (
    <>
      <TopBar user={user}>
        {doc && (
          <>
            <input
              className="title-input"
              value={title}
              disabled={!isOwner}
              title={isOwner ? "Rename document" : "Only the owner can rename"}
              aria-label="Document title"
              maxLength={120}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={rename}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            />
            <span className={`badge ${isOwner ? "badge-owner" : ""}`}>
              {isOwner ? "Owner" : doc.role === "editor" ? "Shared · can edit" : "Shared · view only"}
            </span>
          </>
        )}
      </TopBar>
      <main className="page">
        {!doc ? (
          <p className="muted">Loading…</p>
        ) : (
          <>
            {titleError && <p className="error" role="alert">{titleError}</p>}
            {!canEdit && <div className="banner">You have view-only access. Ask the owner for edit access to make changes.</div>}
            <div className="actions" style={{ marginBottom: 10 }}>
              {isOwner && <button className="btn btn-primary" onClick={() => setShareOpen(true)}>Share</button>}
              <a className="btn" href={`/api/documents/${id}/export`}>Export .md</a>
              {isOwner && <button className="btn btn-danger" onClick={remove}>Delete</button>}
              <span className="spacer" />
              {canEdit && (
                <span className={`status ${save === "error" ? "err" : ""}`} aria-live="polite">
                  {statusText}
                  {save === "error" && <> · <button className="btn" onClick={flush}>Retry</button></>}
                </span>
              )}
            </div>
            {canEdit && editor && <Toolbar editor={editor} />}
          </>
        )}
        <div className={`editor-shell ${canEdit ? "" : "readonly"}`} style={{ display: doc ? "block" : "none" }}>
          <EditorContent editor={editor} />
        </div>
      </main>
      {shareOpen && doc && <ShareDialog doc={doc} onClose={() => setShareOpen(false)} onChange={setDoc} />}
    </>
  );
}
