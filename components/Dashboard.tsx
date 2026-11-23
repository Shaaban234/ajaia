"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import TopBar from "./TopBar";
import Avatar from "./Avatar";
import { useToast } from "./Toasts";
import { IconCrown, IconEye, IconFile, IconPen, IconPlus, IconSparkles, IconUpload, IconUsers } from "./Icons";
import CreateWithAiDialog from "./CreateWithAiDialog";
import { useAiEnabled } from "./useAiEnabled";
import { relativeTime } from "@/lib/ui";
import { TEMPLATES } from "@/lib/templates";
import type { DocumentView, User } from "@/lib/types";

type ListDoc = DocumentView & { excerpt: string };

const NAMES: Record<string, string> = { u_alice: "Alice Khan", u_bob: "Bob Martin", u_carol: "Carol Diaz" };
const ACCEPT = ".txt,.md,.docx";

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? "Working late" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

function DocCard({ d }: { d: ListDoc }) {
  const owner = d.role === "owner";
  return (
    <Link href={`/docs/${d.id}`} className="doc-card">
      <div className="doc-thumb">
        <div className="doc-thumb-paper">
          {d.excerpt ? <p>{d.excerpt}</p> : (<><div className="line t" /><div className="line" /><div className="line" style={{ width: "70%" }} /></>)}
        </div>
      </div>
      <div className="doc-body">
        <div className="doc-title" title={d.title}>{d.title}</div>
        <div className="doc-meta">
          {owner ? (
            <span className="badge badge-owner"><IconCrown />Owner</span>
          ) : d.role === "editor" ? (
            <span className="badge badge-edit"><IconPen />Can edit</span>
          ) : (
            <span className="badge badge-view"><IconEye />View only</span>
          )}
          {owner && d.shares.length > 0 && (
            <span className="avatar-stack" title={`Shared with ${d.shares.map((s) => NAMES[s.userId]).join(", ")}`}>
              {d.shares.slice(0, 3).map((s) => <Avatar key={s.userId} name={NAMES[s.userId] ?? "?"} id={s.userId} />)}
            </span>
          )}
          {!owner && <><Avatar name={NAMES[d.ownerId] ?? "?"} id={d.ownerId} /><span>{NAMES[d.ownerId]?.split(" ")[0]}</span></>}
          <span className="spacer" />
          <span>{relativeTime(d.updatedAt)}</span>
        </div>
      </div>
    </Link>
  );
}

export default function Dashboard({ user }: { user: User }) {
  const router = useRouter();
  const toast = useToast();
  const [docs, setDocs] = useState<ListDoc[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const aiEnabled = useAiEnabled();
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/documents", { cache: "no-store" });
    if (res.status === 401) return router.push("/login");
    if (!res.ok) { setDocs([]); return toast("error", "Could not load your documents."); }
    setDocs((await res.json()).documents);
  }, [router, toast]);

  useEffect(() => { load(); }, [load]);

  async function createDoc(templateId?: string) {
    setBusy(templateId ?? "new");
    const res = await fetch("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(templateId ? { templateId } : {}),
    });
    if (!res.ok) { setBusy(null); return toast("error", (await res.json()).error ?? "Could not create document."); }
    router.push(`/docs/${(await res.json()).document.id}`);
  }

  async function upload(file: File) {
    setBusy("upload");
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/import", { method: "POST", body: form });
    if (fileRef.current) fileRef.current.value = "";
    if (!res.ok) { setBusy(null); return toast("error", (await res.json()).error ?? "Upload failed."); }
    toast("success", `Imported “${file.name}”`);
    router.push(`/docs/${(await res.json()).document.id}`);
  }

  const owned = docs?.filter((d) => d.role === "owner") ?? [];
  const shared = docs?.filter((d) => d.role !== "owner") ?? [];

  return (
    <>
      <TopBar user={user} />
      <main
        className="page"
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={(e) => { if (e.currentTarget === e.target) setDrag(false); }}
        onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) upload(f); }}
      >
        <div className="hero anim-fade-up">
          <div>
            <h1>{greeting()}, {user.name.split(" ")[0]}.</h1>
            <p>Pick up where you left off, start something new, or import a file.</p>
          </div>
          <span className="spacer" />
          <button className="btn" onClick={() => fileRef.current?.click()} disabled={!!busy}>
            {busy === "upload" ? <span className="spinner" /> : <IconUpload />} Import file
          </button>
          <button className="btn btn-ai" onClick={() => setAiOpen(true)} disabled={!!busy}>
            <IconSparkles /> Create with AI
          </button>
          <button className="btn btn-primary" onClick={() => createDoc()} disabled={!!busy}>
            {busy === "new" ? <span className="spinner" /> : <IconPlus />} New document
          </button>
          <input ref={fileRef} type="file" accept={ACCEPT} hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        </div>

        <section className="gallery anim-fade-up" style={{ animationDelay: ".05s" }} aria-label="Start a new document">
          <div className="gallery-head">
            <h2>Start a new document</h2>
            <span className="muted">Pick a template. It becomes a normal editable document you own.</span>
          </div>
          <div className="gallery-row stagger">
            <button className="tpl" onClick={() => createDoc()} disabled={!!busy}>
              <div className="tpl-paper tpl-blank">{busy === "new" ? <span className="spinner" /> : <span className="tpl-plus" aria-hidden><i /><i /><i /><i /></span>}</div>
              <div className="tpl-name">Blank document</div>
              <div className="tpl-variant">&nbsp;</div>
            </button>
            {TEMPLATES.map((t) => (
              <button key={t.id} className="tpl" onClick={() => createDoc(t.id)} disabled={!!busy} style={{ "--tpl-accent": t.accent } as React.CSSProperties}>
                <div className="tpl-paper">
                  <div className="tpl-scale" aria-hidden dangerouslySetInnerHTML={{ __html: t.html }} />
                  {busy === t.id && <div className="tpl-busy"><span className="spinner" /></div>}
                </div>
                <div className="tpl-name">{t.name}</div>
                <div className="tpl-variant">{t.variant}</div>
              </button>
            ))}
          </div>
        </section>

        <div className={`dropzone anim-fade-up ${drag ? "active" : ""}`} style={{ animationDelay: ".08s" }}>
          <div className="dropzone-icon"><IconUpload /></div>
          <div>
            <strong>{drag ? "Drop to import as a new document" : "Drag a file anywhere on this page to import it"}</strong>
            <span className="muted">Supported: <span className="chips"><span className="chip">.txt</span><span className="chip">.md</span><span className="chip">.docx</span></span> · up to 5 MB · headings, bold/italic and lists are kept</span>
          </div>
        </div>

        <section className="section">
          <div className="section-head"><h2>My documents</h2>{docs && <span className="count">{owned.length}</span>}</div>
          {docs === null ? (
            <div className="grid">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton" />)}</div>
          ) : owned.length === 0 ? (
            <div className="empty anim-fade-up">
              <div className="empty-icon"><IconFile /></div>
              <div>
                <strong style={{ display: "block", fontSize: 14, color: "var(--text)" }}>No documents yet</strong>
                <span className="muted">Start from a template above, create a blank document, or drop a .docx / .md / .txt file here.</span>
              </div>
            </div>
          ) : (
            <div className="grid stagger">
              {owned.map((d) => <DocCard key={d.id} d={d} />)}
            </div>
          )}
        </section>

        <section className="section">
          <div className="section-head"><h2>Shared with me</h2>{docs && <span className="count">{shared.length}</span>}</div>
          {docs === null ? (
            <div className="grid">{[0, 1].map((i) => <div key={i} className="skeleton" />)}</div>
          ) : shared.length === 0 ? (
            <div className="empty anim-fade-up">
              <div className="empty-icon"><IconUsers /></div>
              <div>
                <strong style={{ display: "block", fontSize: 14, color: "var(--text)" }}>Nothing shared with you yet</strong>
                <span className="muted">When a teammate shares a document with you, it shows up here with your access level.</span>
              </div>
            </div>
          ) : (
            <div className="grid stagger">{shared.map((d) => <DocCard key={d.id} d={d} />)}</div>
          )}
        </section>

      </main>
      {aiOpen && <CreateWithAiDialog enabled={!!aiEnabled} onClose={() => setAiOpen(false)} />}
    </>
  );
}
