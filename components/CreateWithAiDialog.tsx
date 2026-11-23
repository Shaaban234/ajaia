"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IconAlert, IconSparkles, IconX } from "./Icons";

const IDEAS = [
  "A one-page product brief for a team expense tracker",
  "Weekly engineering sync agenda with action items",
  "Onboarding guide for a new support teammate",
];

export default function CreateWithAiDialog({ enabled, onClose }: { enabled: boolean; onClose: () => void }) {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    ref.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, []);

  async function create() {
    if (!enabled) return setError("AI isn't configured on this deployment. Set AI_API_KEY (see README).");
    setBusy(true);
    setError("");
    const res = await fetch("/api/ai/document", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt }) });
    const body = await res.json();
    if (!res.ok) { setBusy(false); return setError(body.error ?? "Could not create the document."); }
    router.push(`/docs/${body.document.id}`);
  }

  return (
    <div className="modal-backdrop" onMouseDown={() => !busy && onClose()}>
      <div className="modal ai-modal" role="dialog" aria-modal="true" aria-labelledby="ai-create-title" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-icon ai-badge"><IconSparkles /></div>
          <div style={{ flex: 1 }}>
            <h2 id="ai-create-title">Create with AI</h2>
            <p className="muted">Describe the document. AI writes a first draft you can edit, format and share.</p>
          </div>
          <button className="icon-btn plain" onClick={onClose} aria-label="Close" disabled={busy}><IconX /></button>
        </div>
        <div className="modal-body">
          <textarea
            ref={ref}
            className="input ai-textarea"
            rows={4}
            maxLength={2000}
            placeholder="e.g. A project plan for migrating our blog to Next.js, with milestones and risks"
            value={prompt}
            disabled={busy}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && prompt.trim()) create(); }}
          />
          <div className="suggestions">
            {IDEAS.map((i) => <button key={i} type="button" className="suggestion" style={{ paddingLeft: 10 }} disabled={busy} onClick={() => setPrompt(i)}>{i}</button>)}
          </div>
          {error && <div className="error-box" role="alert" style={{ marginTop: 12 }}><IconAlert width={16} />{error}</div>}
        </div>
        <div className="modal-foot">
          <span className="muted">{busy ? "Drafting your document…" : "Ctrl + Enter to create"}</span>
          <button className="btn btn-primary" disabled={busy || !prompt.trim()} onClick={create}>
            {busy ? <span className="spinner" /> : <IconSparkles />}{busy ? "Writing…" : "Create draft"}
          </button>
        </div>
      </div>
    </div>
  );
}
