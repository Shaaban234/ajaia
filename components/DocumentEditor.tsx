"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { CharacterCount, Placeholder } from "@tiptap/extensions";
import Toolbar from "./Toolbar";
import ShareDialog from "./ShareDialog";
import AiPanel from "./AiPanel";
import Avatar from "./Avatar";
import Menu from "./Menu";
import { useToast } from "./Toasts";
import { useAiEnabled } from "./useAiEnabled";
import {
  IconAlert, IconCheck, IconDownload, IconEye, IconFile, IconKeyboard, IconLock, IconLogout,
  IconPlus, IconRedo, IconSparkles, IconTrash, IconUndo, IconUsers,
} from "./Icons";
import { relativeTime } from "@/lib/ui";
import type { DocumentView, User } from "@/lib/types";

type SaveState = "saved" | "dirty" | "saving" | "error";
const AUTOSAVE_MS = 800;
const NAMES: Record<string, string> = { u_alice: "Alice Khan", u_bob: "Bob Martin", u_carol: "Carol Diaz" };

function SaveStatus({ state, onRetry, updatedAt }: { state: SaveState; onRetry: () => void; updatedAt?: string }) {
  if (state === "saving") return <span className="save-status saving" aria-live="polite"><span className="dot" />Saving…</span>;
  if (state === "error") return <button className="save-status error" onClick={onRetry}><IconAlert />Couldn&apos;t save · Retry</button>;
  if (state === "dirty") return <span className="save-status" aria-live="polite"><span className="dot" />Unsaved changes</span>;
  return <span className="save-status saved" aria-live="polite" title={updatedAt ? `Last edit ${new Date(updatedAt).toLocaleString()}` : undefined}><IconCheck />Saved{updatedAt ? ` · ${relativeTime(updatedAt)}` : ""}</span>;
}

export default function DocumentEditor({ user, id }: { user: User; id: string }) {
  const router = useRouter();
  const toast = useToast();
  const aiEnabled = useAiEnabled();
  const [doc, setDoc] = useState<DocumentView | null>(null);
  const [loadError, setLoadError] = useState("");
  const [title, setTitle] = useState("");
  const [save, setSave] = useState<SaveState>("saved");
  const [shareOpen, setShareOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<string | null>(null);
  const lastSaved = useRef<string>("");
  const editable = useRef(false);
  const titleRef = useRef<HTMLInputElement>(null);

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
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error);
      lastSaved.current = html;
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
      Placeholder.configure({ placeholder: "Type here, or press Ctrl+J to write with AI…" }),
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

  // Keyboard shortcuts, unsaved-changes warning, flush on unmount.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (pending.current !== null) { e.preventDefault(); e.returnValue = ""; }
    };
    const key = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "s") { e.preventDefault(); flush(); }
      if (mod && e.key.toLowerCase() === "j" && editable.current) { e.preventDefault(); setAiOpen((o) => !o); }
      if (mod && e.key === "\\" && editable.current) { e.preventDefault(); editor?.chain().focus().unsetAllMarks().clearNodes().run(); }
    };
    window.addEventListener("beforeunload", warn);
    window.addEventListener("keydown", key);
    return () => { window.removeEventListener("beforeunload", warn); window.removeEventListener("keydown", key); flush(); };
  }, [flush, editor]);

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

  async function newDoc() {
    await flush();
    const res = await fetch("/api/documents", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    if (!res.ok) return toast("error", "Could not create document.");
    router.push(`/docs/${(await res.json()).document.id}`);
  }

  async function signOut() {
    await flush();
    await fetch("/api/session", { method: "DELETE" });
    router.push("/login");
    router.refresh();
  }

  if (loadError) {
    return (
      <main className="page">
        <div className="empty anim-fade-up" style={{ maxWidth: 520, margin: "80px auto" }}>
          <div className="empty-icon"><IconAlert /></div>
          <div style={{ flex: 1 }}>
            <strong style={{ display: "block", color: "var(--text)" }}>{loadError}</strong>
            <span className="muted">It may have been deleted, or you don&apos;t have access.</span>
          </div>
          <Link href="/" className="btn">Back</Link>
        </div>
      </main>
    );
  }

  // Collaborators other than the current user (your own avatar is shown separately).
  const people = doc ? [doc.ownerId, ...doc.shares.map((s) => s.userId)].filter((p) => p !== user.id) : [];
  const ed = editor;

  return (
    <div className="docs-ui">
      <header className="docs-header">
        <Link href="/" className="docs-logo" title="All documents" aria-label="All documents"><IconFile /></Link>
        <div className="docs-titlebox">
          <div className="docs-titlerow">
            {doc ? (
              <input
                ref={titleRef}
                className="docs-title"
                value={title}
                disabled={!isOwner}
                title={isOwner ? "Rename" : "Only the owner can rename"}
                aria-label="Document title"
                maxLength={120}
                size={Math.min(Math.max(title.length, 6), 50)}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={rename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  if (e.key === "Escape") { setTitle(doc.title); (e.target as HTMLInputElement).blur(); }
                }}
              />
            ) : <span className="docs-title-skel" />}
            {doc && !isOwner && <span className={`badge ${doc.role === "editor" ? "badge-edit" : "badge-view"}`}>{doc.role === "editor" ? "Shared · can edit" : "Shared · view only"}</span>}
            {doc && canEdit && <SaveStatus state={save} onRetry={flush} updatedAt={doc.updatedAt} />}
          </div>
          {doc && (
            <nav className="menubar" aria-label="Document menu">
              <Menu label="File" items={[
                { label: "New document", icon: <IconPlus />, onClick: newDoc },
                { label: "Open all documents", icon: <IconFile />, onClick: () => router.push("/") },
                "divider",
                { label: "Share…", icon: <IconUsers />, onClick: () => setShareOpen(true), disabled: !isOwner },
                { label: "Rename", onClick: () => titleRef.current?.select(), disabled: !isOwner },
                { label: "Download as Markdown (.md)", icon: <IconDownload />, onClick: () => { window.location.href = `/api/documents/${id}/export`; } },
                "divider",
                { label: "Delete document", icon: <IconTrash />, onClick: remove, disabled: !isOwner, danger: true },
              ]} />
              <Menu label="Edit" items={[
                { label: "Undo", icon: <IconUndo />, shortcut: "Ctrl+Z", onClick: () => ed?.chain().focus().undo().run(), disabled: !canEdit },
                { label: "Redo", icon: <IconRedo />, shortcut: "Ctrl+Y", onClick: () => ed?.chain().focus().redo().run(), disabled: !canEdit },
                "divider",
                { label: "Select all", shortcut: "Ctrl+A", onClick: () => ed?.chain().focus().selectAll().run() },
              ]} />
              <Menu label="Insert" items={[
                { label: "Heading 1", onClick: () => ed?.chain().focus().setHeading({ level: 1 }).run(), disabled: !canEdit },
                { label: "Heading 2", onClick: () => ed?.chain().focus().setHeading({ level: 2 }).run(), disabled: !canEdit },
                { label: "Bulleted list", onClick: () => ed?.chain().focus().toggleBulletList().run(), disabled: !canEdit },
                { label: "Numbered list", onClick: () => ed?.chain().focus().toggleOrderedList().run(), disabled: !canEdit },
                { label: "Horizontal line", onClick: () => ed?.chain().focus().setHorizontalRule().run(), disabled: !canEdit },
              ]} />
              <Menu label="Format" items={[
                { label: "Bold", shortcut: "Ctrl+B", onClick: () => ed?.chain().focus().toggleBold().run(), disabled: !canEdit },
                { label: "Italic", shortcut: "Ctrl+I", onClick: () => ed?.chain().focus().toggleItalic().run(), disabled: !canEdit },
                { label: "Underline", shortcut: "Ctrl+U", onClick: () => ed?.chain().focus().toggleUnderline().run(), disabled: !canEdit },
                "divider",
                { label: "Clear formatting", shortcut: "Ctrl+\\", onClick: () => ed?.chain().focus().unsetAllMarks().clearNodes().run(), disabled: !canEdit },
              ]} />
              <Menu label="AI" items={[
                { label: "Write with AI", icon: <IconSparkles />, shortcut: "Ctrl+J", onClick: () => setAiOpen(true), disabled: !canEdit },
              ]} />
              <Menu label="Help" items={[
                { label: "Keyboard shortcuts", icon: <IconKeyboard />, onClick: () => setHelpOpen(true) },
              ]} />
            </nav>
          )}
        </div>
        <span className="spacer" />
        {doc && people.length > 0 && (
          <span className="avatar-stack hide-sm" title={`Also has access: ${people.map((p) => NAMES[p]).join(", ")}`}>
            {people.slice(0, 4).map((p) => <Avatar key={p} name={NAMES[p] ?? "?"} id={p} />)}
          </span>
        )}
        {doc && (
          <button className="share-pill" onClick={() => isOwner ? setShareOpen(true) : toast("error", "Only the owner can change sharing.")} title={isOwner ? "Share" : "Only the owner can share"}>
            <IconLock /><span>Share</span>
          </button>
        )}
        <button className="docs-avatar" onClick={signOut} title={`${user.name} · Sign out`} aria-label="Sign out">
          <Avatar name={user.name} id={user.id} size="lg" />
          <span className="docs-avatar-out"><IconLogout /></span>
        </button>
      </header>

      {doc && editor && <div className="docs-toolbar-wrap"><Toolbar editor={editor} canEdit={canEdit} onAi={() => setAiOpen((o) => !o)} aiOpen={aiOpen} /></div>}

      <main className="docs-canvas">
        {doc && !canEdit && (
          <div className="readonly-banner">
            <IconEye />
            <span><strong>View only.</strong> {NAMES[doc.ownerId] ?? "The owner"} shared this with you as a viewer. Ask them for edit access to make changes.</span>
          </div>
        )}
        {aiOpen && editor && canEdit && (
          <div className="ai-dock"><AiPanel editor={editor} enabled={!!aiEnabled} onClose={() => setAiOpen(false)} /></div>
        )}
        {!doc && <div className="docs-page loading-sheet" />}
        <div className="docs-page" style={{ display: doc ? "block" : "none" }}>
          <EditorContent editor={editor} />
        </div>
        {doc && (
          <div className="docs-statusbar">
            <span>{counts?.words ?? 0} words</span>
            <span>{counts?.chars ?? 0} characters</span>
            <span>Owner: {NAMES[doc.ownerId]}</span>
          </div>
        )}
      </main>

      {doc && canEdit && !aiOpen && (
        <button className="ai-fab" onClick={() => setAiOpen(true)} title="Write with AI (Ctrl+J)" aria-label="Write with AI">
          <IconSparkles /><span>Write with AI</span>
        </button>
      )}

      {helpOpen && (
        <div className="modal-backdrop" onMouseDown={() => setHelpOpen(false)}>
          <div className="modal" role="dialog" aria-label="Keyboard shortcuts" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head"><div className="modal-icon"><IconKeyboard /></div><div><h2>Keyboard shortcuts</h2></div></div>
            <div className="modal-body shortcuts">
              {[["Bold", "Ctrl+B"], ["Italic", "Ctrl+I"], ["Underline", "Ctrl+U"], ["Bulleted list", "Ctrl+Shift+8"], ["Numbered list", "Ctrl+Shift+7"],
                ["Heading 1–3", "Ctrl+Alt+1–3"], ["Clear formatting", "Ctrl+\\"], ["Write with AI", "Ctrl+J"], ["Save now", "Ctrl+S"], ["Undo / Redo", "Ctrl+Z / Ctrl+Y"]]
                .map(([a, k]) => <div key={a}><span>{a}</span><kbd>{k}</kbd></div>)}
            </div>
            <div className="modal-foot"><span className="muted">Mac: use ⌘ instead of Ctrl</span><button className="btn" onClick={() => setHelpOpen(false)}>Close</button></div>
          </div>
        </div>
      )}

      {shareOpen && doc && <ShareDialog doc={doc} onClose={() => setShareOpen(false)} onChange={setDoc} />}
    </div>
  );
}
