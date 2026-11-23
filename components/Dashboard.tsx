"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import TopBar from "./TopBar";
import type { DocumentView, User } from "@/lib/types";

const USER_NAMES: Record<string, string> = { u_alice: "Alice Khan", u_bob: "Bob Martin", u_carol: "Carol Diaz" };

function when(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function Dashboard({ user }: { user: User }) {
  const router = useRouter();
  const [docs, setDocs] = useState<DocumentView[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/documents", { cache: "no-store" });
    if (res.status === 401) return router.push("/login");
    if (!res.ok) return setError("Could not load documents.");
    setDocs((await res.json()).documents);
  }, [router]);

  useEffect(() => { load(); }, [load]);

  async function createDoc() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/documents", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    setBusy(false);
    if (!res.ok) return setError((await res.json()).error ?? "Could not create document.");
    router.push(`/docs/${(await res.json()).document.id}`);
  }

  async function upload(file: File) {
    setBusy(true);
    setError("");
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/import", { method: "POST", body: form });
    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
    if (!res.ok) return setError((await res.json()).error ?? "Upload failed.");
    router.push(`/docs/${(await res.json()).document.id}`);
  }

  const owned = docs?.filter((d) => d.role === "owner") ?? [];
  const shared = docs?.filter((d) => d.role !== "owner") ?? [];

  return (
    <>
      <TopBar user={user} />
      <main className="page">
        <div className="actions">
          <button className="btn btn-primary" onClick={createDoc} disabled={busy}>+ New document</button>
          <button className="btn" onClick={() => fileRef.current?.click()} disabled={busy}>Import file…</button>
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.md,.docx"
            hidden
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
          />
          <span className="muted">Import supports .txt, .md and .docx (max 5 MB) and creates a new editable document.</span>
        </div>
        {error && <p className="error" role="alert">{error}</p>}

        {docs === null ? (
          <p className="muted" style={{ marginTop: 24 }}>Loading…</p>
        ) : (
          <>
            <h2 className="section-title">My documents <span className="badge">{owned.length}</span></h2>
            {owned.length === 0 ? (
              <div className="empty">No documents yet. Create one or import a file.</div>
            ) : (
              <ul className="doc-list">
                {owned.map((d) => (
                  <li key={d.id}>
                    <Link className="doc-item" href={`/docs/${d.id}`}>
                      <strong>{d.title}</strong>
                      <span className="badge badge-owner">Owner</span>
                      {d.shares.length > 0 && <span className="badge">Shared with {d.shares.length}</span>}
                      <span className="spacer" />
                      <span className="muted">Edited {when(d.updatedAt)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            <h2 className="section-title">Shared with me <span className="badge">{shared.length}</span></h2>
            {shared.length === 0 ? (
              <div className="empty">Nothing has been shared with you yet.</div>
            ) : (
              <ul className="doc-list">
                {shared.map((d) => (
                  <li key={d.id}>
                    <Link className="doc-item" href={`/docs/${d.id}`}>
                      <strong>{d.title}</strong>
                      <span className="badge">{d.role === "editor" ? "Can edit" : "View only"}</span>
                      <span className="muted">from {USER_NAMES[d.ownerId] ?? d.ownerId}</span>
                      <span className="spacer" />
                      <span className="muted">Edited {when(d.updatedAt)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </main>
    </>
  );
}
