"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { CharacterCount, Placeholder } from "@tiptap/extensions";
import { TextStyleKit } from "@tiptap/extension-text-style";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import Image from "@tiptap/extension-image";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import Toolbar, { type Command } from "./Toolbar";
import Ruler from "./Ruler";
import CommentsPanel, { type PendingComment } from "./CommentsPanel";
import VersionsPanel from "./VersionsPanel";
import { CommentMark } from "@/lib/commentMark";
import ShareDialog from "./ShareDialog";
import AiPanel from "./AiPanel";
import Avatar from "./Avatar";
import Menu from "./Menu";
import { useToast } from "./Toasts";
import { useAiEnabled } from "./useAiEnabled";
import {
  IconAlert, IconCheck, IconDownload, IconEye, IconFile, IconKeyboard, IconLock, IconLogout,
  IconPlus, IconRedo, IconSparkles, IconTrash, IconUndo, IconUsers, IconComment, IconCommentAdd, IconHistory,
} from "./Icons";
import { relativeTime } from "@/lib/ui";
import type { DocumentView, Presence, User, Version } from "@/lib/types";

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
  const [mode, setMode] = useState<"editing" | "viewing">("editing");
  const [zoom, setZoom] = useState(100);
  const [spellcheck, setSpellcheck] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [pendingComment, setPendingComment] = useState<PendingComment | null>(null);
  const [activeComment, setActiveComment] = useState<string | null>(null);
  const [commentCount, setCommentCount] = useState(0);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [preview, setPreview] = useState<Version | null>(null);
  const [historyKey, setHistoryKey] = useState(0);
  const [presence, setPresence] = useState<Presence[]>([]);
  const [conflict, setConflict] = useState<{ message: string; theirs: DocumentView } | null>(null);
  /** updatedAt of the server version this editor is based on (for conflict detection). */
  const base = useRef<string>("");
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
        body: JSON.stringify({ content: html, baseUpdatedAt: base.current || undefined }),
      });
      const body = await res.json().catch(() => null);
      if (res.status === 409 && body?.conflict) {
        pending.current = html; // keep local work; the user decides in the conflict banner
        setConflict({ message: body.error, theirs: body.document });
        setSave("dirty");
        return;
      }
      if (!res.ok) throw new Error(body?.error);
      lastSaved.current = html;
      if (body?.document) { base.current = body.document.updatedAt; setDoc((d) => (d ? { ...d, updatedAt: body.document.updatedAt, updatedBy: body.document.updatedBy } : d)); }
      // Only mark saved if nothing new was typed while the request was in flight.
      setSave(pending.current === null ? "saved" : "dirty");
    } catch {
      pending.current ??= html; // keep the unsaved content for retry
      setSave("error");
    }
  }, [id]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: { openOnClick: false, autolink: true, defaultProtocol: "https" } }),
      TextStyleKit.configure({ backgroundColor: false }),
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Image.configure({ inline: false }),
      TaskList,
      TaskItem.configure({ nested: true }),
      CommentMark,
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
      if (!conflictRef.current) timer.current = setTimeout(flush, AUTOSAVE_MS);
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
      base.current = d.updatedAt;
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
      if (mod && e.altKey && e.shiftKey && e.key.toLowerCase() === "h") { e.preventDefault(); openHistoryRef.current(); }
      if (mod && e.altKey && e.key.toLowerCase() === "m") { e.preventDefault(); startCommentRef.current(); }
      if (mod && e.shiftKey && e.key.toLowerCase() === "f") { e.preventDefault(); setCollapsed((c) => !c); }
      if (mod && e.key === "\\" && editable.current) { e.preventDefault(); editor?.chain().focus().unsetAllMarks().clearNodes().run(); }
    };
    window.addEventListener("beforeunload", warn);
    window.addEventListener("keydown", key);
    return () => { window.removeEventListener("beforeunload", warn); window.removeEventListener("keydown", key); flush(); };
  }, [flush, editor]);

  // Editing/Viewing mode (Docs-style): editors can switch to a read-only view of their own document.
  useEffect(() => {
    if (!editor || !doc) return;
    editable.current = doc.role !== "viewer" && mode === "editing";
    editor.setEditable(editable.current, false);
    if (!editable.current) setAiOpen(false);
  }, [mode, editor, doc]);

  useEffect(() => {
    editor?.view.dom.setAttribute("spellcheck", String(spellcheck));
  }, [editor, spellcheck, doc]);

  // Keep the tab title in sync with the document, like Docs.
  useEffect(() => {
    if (doc) document.title = `${doc.title} - Ajaia Docs`;
  }, [doc]);

  // Clicking highlighted text opens its comment thread.
  useEffect(() => {
    if (!editor) return;
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement).closest("[data-comment-id]");
      if (el) { setCommentsOpen(true); setActiveComment(el.getAttribute("data-comment-id")); }
    };
    const dom = editor.view.dom;
    dom.addEventListener("click", onClick);
    return () => dom.removeEventListener("click", onClick);
  }, [editor]);

  function startComment() {
    if (!editor || !doc) return;
    if (!(doc.role === "owner" || doc.role === "editor")) return toast("error", "Only people who can edit can start comments. You can reply to existing ones.");
    const { from, to, empty } = editor.state.selection;
    if (empty) return toast("error", "Select some text to comment on.");
    const quote = editor.state.doc.textBetween(from, to, " ").trim();
    if (!quote) return toast("error", "Select some text to comment on.");
    setPendingComment({ id: crypto.randomUUID(), from, to, quote });
    setCommentsOpen(true);
  }
  const openHistoryRef = useRef(() => {});
  const startCommentRef = useRef(startComment);
  startCommentRef.current = startComment;

  const conflictRef = useRef(conflict);
  conflictRef.current = conflict;

  /** Replace editor content with a server copy (remote changes, "use theirs", restores). */
  const applyServerDoc = useCallback((d: DocumentView) => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    editor.commands.setContent(d.content, { emitUpdate: false });
    const max = editor.state.doc.content.size;
    try { editor.commands.setTextSelection({ from: Math.min(from, max), to: Math.min(to, max) }); } catch { /* selection may no longer exist */ }
    lastSaved.current = editor.getHTML();
    pending.current = null;
    base.current = d.updatedAt;
    setDoc((cur) => (cur ? { ...cur, content: d.content, title: d.title, updatedAt: d.updatedAt, updatedBy: d.updatedBy } : cur));
    setTitle(d.title);
    setSave("saved");
  }, [editor]);

  // Presence heartbeat + live sync (polling keeps it serverless-friendly; see ARCHITECTURE.md).
  useEffect(() => {
    if (!doc || !editor) return;
    let stopped = false;
    const beat = async () => {
      if (document.hidden) return;
      try {
        const res = await fetch(`/api/documents/${id}/presence`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: editable.current ? "editing" : "viewing" }),
        });
        if (!res.ok || stopped) return;
        const b = await res.json();
        setPresence(b.presence ?? []);
        const remoteNewer = b.updatedAt && base.current && new Date(b.updatedAt) > new Date(base.current) && b.updatedBy && b.updatedBy !== user.id;
        if (remoteNewer && !conflictRef.current) {
          const r = await fetch(`/api/documents/${id}`, { cache: "no-store" });
          if (!r.ok || stopped) return;
          const theirs: DocumentView = (await r.json()).document;
          const who = NAMES[theirs.updatedBy ?? ""] ?? "A collaborator";
          if (pending.current === null) {
            applyServerDoc(theirs);
            toast("success", `Updated with ${who.split(" ")[0]}'s latest changes`);
          } else {
            setConflict({ message: `${who} edited this document while you were editing.`, theirs });
          }
        }
      } catch { /* offline: try again next beat */ }
    };
    beat();
    const t = setInterval(beat, 5000);
    return () => { stopped = true; clearInterval(t); };
  }, [doc?.id, editor, id, user.id, applyServerDoc, toast]); // eslint-disable-line react-hooks/exhaustive-deps

  function useTheirs() {
    if (!conflict) return;
    applyServerDoc(conflict.theirs);
    setConflict(null);
    toast("success", "Loaded the latest version");
  }

  async function keepMine() {
    if (!conflict || !editor) return;
    base.current = conflict.theirs.updatedAt; // acknowledge their version, then overwrite deliberately
    pending.current = editor.getHTML();
    setConflict(null);
    await flush();
  }

  async function selectVersion(v: Omit<Version, "content"> | null) {
    if (!v) return setPreview(null);
    const r = await fetch(`/api/documents/${id}/versions/${v.id}`, { cache: "no-store" });
    if (!r.ok) return toast("error", "Could not load that version.");
    setPreview((await r.json()).version);
  }

  async function restoreVersion() {
    if (!preview) return;
    await flush();
    const r = await fetch(`/api/documents/${id}/versions/${preview.id}`, { method: "POST" });
    const b = await r.json();
    if (!r.ok) return toast("error", b.error ?? "Restore failed.");
    applyServerDoc(b.document);
    setPreview(null);
    setHistoryKey((k) => k + 1);
    toast("success", "Version restored. The previous state was kept in history.");
  }

  function openHistory() {
    setCommentsOpen(false);
    setHistoryOpen(true);
    setHistoryKey((k) => k + 1);
  }
  openHistoryRef.current = openHistory;

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
  const commands: Command[] = [
    { label: "New document", run: newDoc },
    { label: "Open all documents", run: () => router.push("/") },
    { label: "Share", run: () => setShareOpen(true), disabled: !isOwner },
    { label: "Rename document", run: () => titleRef.current?.select(), disabled: !isOwner },
    { label: "Download as Markdown", run: () => { window.location.href = `/api/documents/${id}/export`; } },
    { label: "Delete document", run: remove, disabled: !isOwner },
    { label: "Keyboard shortcuts", run: () => setHelpOpen(true) },
    { label: "Add comment", hint: "Ctrl+Alt+M", run: startComment, disabled: !canEdit },
    { label: "Open comments", run: () => setCommentsOpen(true) },
    { label: "Version history", hint: "Ctrl+Alt+Shift+H", run: openHistory },
  ];

  const people = doc ? [doc.ownerId, ...doc.shares.map((s) => s.userId)].filter((p) => p !== user.id) : [];
  const ed = editor;

  return (
    <div className="docs-ui">
      <header className={`docs-header ${collapsed ? "collapsed" : ""}`}>
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
                { label: "Print", shortcut: "Ctrl+P", onClick: () => window.print() },
                { label: "Version history", icon: <IconHistory />, shortcut: "Ctrl+Alt+Shift+H", onClick: openHistory },
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
                "divider",
                { label: "Comment", icon: <IconCommentAdd />, shortcut: "Ctrl+Alt+M", onClick: startComment, disabled: !canEdit },
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
        {doc && (presence.length > 0 || people.length > 0) && (
          <div className="presence hide-sm">
            {presence.length > 0 && (
              <span className="presence-label">
                {presence.length === 1
                  ? `${(NAMES[presence[0].userId] ?? "Someone").split(" ")[0]} is ${presence[0].mode}`
                  : `${presence.length} others here`}
              </span>
            )}
            <span className="avatar-stack">
              {[...presence.map((p) => p.userId), ...people.filter((p) => !presence.some((x) => x.userId === p))].slice(0, 5).map((uid) => {
                const live = presence.find((p) => p.userId === uid);
                return (
                  <span key={uid} className={`pres-av ${live ? "online" : "offline"}`} title={live ? `${NAMES[uid]} is ${live.mode} now` : `${NAMES[uid]} has access (not here now)`}>
                    <Avatar name={NAMES[uid] ?? "?"} id={uid} />
                  </span>
                );
              })}
            </span>
          </div>
        )}
        {doc && (
          <button className={`icon-btn plain hdr-comments ${historyOpen ? "on" : ""}`} onClick={() => (historyOpen ? (setHistoryOpen(false), setPreview(null)) : openHistory())} title="Version history" aria-label="Version history">
            <IconHistory />
          </button>
        )}
        {doc && (
          <button className={`icon-btn plain hdr-comments ${commentsOpen ? "on" : ""}`} onClick={() => { setHistoryOpen(false); setPreview(null); setCommentsOpen((o) => !o); }} title="Open comment history" aria-label="Comments">
            <IconComment />{commentCount > 0 && <span className="hdr-badge">{commentCount}</span>}
          </button>
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

      {doc && editor && (
        <div className={`docs-toolbar-wrap ${collapsed ? "collapsed" : ""}`}>
          <Toolbar
            editor={editor} canEdit={canEdit} mode={mode} onModeChange={setMode}
            zoom={zoom} onZoom={setZoom} spellcheck={spellcheck} onSpellcheck={setSpellcheck}
            onAi={() => setAiOpen((o) => !o)} aiOpen={aiOpen}
            collapsed={collapsed} onToggleCollapse={() => setCollapsed((c) => !c)}
            commands={commands}
            onComment={startComment}
          />
          <Ruler zoom={zoom} />
        </div>
      )}

      <main className="docs-canvas">
        {doc && !canEdit && (
          <div className="readonly-banner">
            <IconEye />
            <span><strong>View only.</strong> {NAMES[doc.ownerId] ?? "The owner"} shared this with you as a viewer. Ask them for edit access to make changes.</span>
          </div>
        )}
        {conflict && (
          <div className="conflict-banner" role="alert">
            <IconAlert />
            <span><strong>{conflict.message}</strong> Your latest changes are not saved yet.</span>
            <span className="spacer" />
            <button className="btn btn-sm" onClick={useTheirs}>Use their version</button>
            <button className="btn btn-sm btn-primary" onClick={keepMine}>Keep mine</button>
          </div>
        )}
        {preview && (
          <div className="version-banner">
            <IconHistory />
            <span>Viewing a version from <strong>{new Date(preview.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</strong> by {NAMES[preview.authorId] ?? preview.authorId}</span>
            <span className="spacer" />
            <button className="btn btn-sm" onClick={() => setPreview(null)}>Back to current</button>
            {canEdit && <button className="btn btn-sm btn-primary" onClick={restoreVersion}>Restore this version</button>}
          </div>
        )}
        {aiOpen && editor && canEdit && mode === "editing" && (
          <div className="ai-dock"><AiPanel editor={editor} enabled={!!aiEnabled} onClose={() => setAiOpen(false)} /></div>
        )}
        {!doc && <div className="docs-page loading-sheet" />}
        <div className={`page-row ${commentsOpen || historyOpen ? "with-comments" : ""}`}>
          <div className="docs-page" style={{ display: doc && !preview ? "block" : "none", zoom: zoom / 100 } as React.CSSProperties}>
            <EditorContent editor={editor} />
          </div>
          {preview && (
            <div className="docs-page preview-page" style={{ zoom: zoom / 100 } as React.CSSProperties}>
              <div className="ProseMirror" dangerouslySetInnerHTML={{ __html: preview.content }} />
            </div>
          )}
          {doc && historyOpen && (
            <VersionsPanel docId={doc.id} selectedId={preview?.id ?? null} onSelect={selectVersion} refreshKey={historyKey}
              onClose={() => { setHistoryOpen(false); setPreview(null); }} />
          )}
          {doc && editor && commentsOpen && !historyOpen && (
            <CommentsPanel editor={editor} doc={doc} user={user} pending={pendingComment} onPendingDone={() => setPendingComment(null)}
              activeId={activeComment} onActivate={setActiveComment} onClose={() => { setCommentsOpen(false); setPendingComment(null); }} onCount={setCommentCount} />
          )}
        </div>
        {doc && (
          <div className="docs-statusbar">
            <span>{counts?.words ?? 0} words</span>
            <span>{counts?.chars ?? 0} characters</span>
            <span>Owner: {NAMES[doc.ownerId]}</span>
          </div>
        )}
      </main>

      {doc && canEdit && mode === "editing" && !aiOpen && (
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
                ["Heading 1–3", "Ctrl+Alt+1–3"], ["Clear formatting", "Ctrl+\\"], ["Checklist", "Ctrl+Shift+9"], ["Add comment", "Ctrl+Alt+M"], ["Write with AI", "Ctrl+J"], ["Save now", "Ctrl+S"], ["Print", "Ctrl+P"], ["Hide menus", "Ctrl+Shift+F"], ["Undo / Redo", "Ctrl+Z / Ctrl+Y"]]
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
