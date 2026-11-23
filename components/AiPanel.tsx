"use client";
import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { useToast } from "./Toasts";
import { IconAlert, IconRefresh, IconSend, IconSparkles, IconX } from "./Icons";

type Action = "draft" | "continue" | "improve" | "shorten" | "expand" | "fix" | "professional";
type Result = { html: string; model: string };

const SELECTION_ACTIONS: { id: Action; label: string }[] = [
  { id: "improve", label: "Improve writing" },
  { id: "fix", label: "Fix grammar" },
  { id: "shorten", label: "Make shorter" },
  { id: "expand", label: "Make longer" },
  { id: "professional", label: "More professional" },
];

const DRAFT_IDEAS = ["Meeting agenda for a weekly product sync", "Project kickoff brief with goals and risks", "Onboarding checklist for a new engineer"];

/**
 * The AI never edits the document directly: it returns a preview, and the user
 * decides to insert, replace, retry or discard. Judgment stays with the human.
 */
export default function AiPanel({ editor, enabled, onClose }: { editor: Editor; enabled: boolean; onClose: () => void }) {
  const toast = useToast();
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const lastCall = useRef<{ action: Action; prompt?: string } | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Capture the selection when the panel opens so focus moving into the panel doesn't lose it.
  const [range] = useState(() => {
    const { from, to } = editor.state.selection;
    return { from, to, text: editor.state.doc.textBetween(from, to, "\n\n").trim() };
  });
  const hasSelection = range.text.length > 0;

  useEffect(() => {
    inputRef.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  async function run(action: Action, p?: string) {
    if (!enabled) return setError("AI isn't configured on this deployment. Set AI_API_KEY (see README).");
    lastCall.current = { action, prompt: p };
    setBusy(true);
    setError("");
    setResult(null);
    const context = editor.getText().slice(-4000);
    const payload =
      action === "draft" ? { action, prompt: p, context: context || undefined }
      : action === "continue" ? { action, context }
      : { action, text: range.text, prompt: p };
    try {
      const res = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "AI request failed.");
      setResult({ html: body.html, model: body.model });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function submitPrompt() {
    const p = prompt.trim();
    if (!p) return;
    run(hasSelection ? "improve" : "draft", p);
  }

  function apply(mode: "insert" | "replace") {
    if (!result) return;
    const chain = editor.chain().focus();
    if (mode === "replace" && hasSelection) chain.insertContentAt({ from: range.from, to: range.to }, result.html).run();
    else chain.insertContentAt(hasSelection ? range.to : editor.state.selection.to, result.html).run();
    toast("success", mode === "replace" ? "Replaced with AI suggestion" : "Inserted AI suggestion");
    onClose();
  }

  return (
    <div className="ai-panel" role="dialog" aria-label="Write with AI">
      <div className="ai-head">
        <span className="ai-badge"><IconSparkles /></span>
        <div style={{ flex: 1 }}>
          <strong>Write with AI</strong>
          <span className="muted">{hasSelection ? `Working on your selection (${range.text.split(/\s+/).length} words)` : "Draft new content at your cursor"}</span>
        </div>
        <button className="icon-btn plain" onClick={onClose} aria-label="Close AI panel"><IconX /></button>
      </div>

      {!result && !busy && (
        <>
          {hasSelection ? (
            <div className="ai-actions">
              {SELECTION_ACTIONS.map((a) => <button key={a.id} className="ai-chip" onClick={() => run(a.id)}>{a.label}</button>)}
            </div>
          ) : (
            <div className="ai-actions">
              {editor.getText().trim() && <button className="ai-chip" onClick={() => run("continue")}>Continue writing</button>}
              {DRAFT_IDEAS.map((idea) => <button key={idea} className="ai-chip" onClick={() => { setPrompt(idea); inputRef.current?.focus(); }}>{idea}</button>)}
            </div>
          )}
          <form className="ai-prompt" onSubmit={(e) => { e.preventDefault(); submitPrompt(); }}>
            <textarea
              ref={inputRef}
              rows={2}
              placeholder={hasSelection ? "Or tell AI how to change it, e.g. “turn into a bullet list”" : "What should I write? e.g. “a short intro for our Q4 launch plan”"}
              value={prompt}
              maxLength={2000}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitPrompt(); } }}
            />
            <button className="btn btn-primary btn-sm" disabled={!prompt.trim()} aria-label="Generate"><IconSend /></button>
          </form>
        </>
      )}

      {busy && (
        <div className="ai-loading" aria-live="polite">
          <div className="ai-shimmer" style={{ width: "92%" }} /><div className="ai-shimmer" style={{ width: "78%" }} /><div className="ai-shimmer" style={{ width: "85%" }} />
          <span className="muted">Thinking…</span>
        </div>
      )}

      {error && <div className="error-box" role="alert"><IconAlert width={16} />{error}</div>}

      {result && (
        <>
          <div className="ai-preview ProseMirror-preview" dangerouslySetInnerHTML={{ __html: result.html }} />
          <div className="ai-foot">
            <span className="muted" title="Model that produced this suggestion">via {result.model}</span>
            <span className="spacer" />
            <button className="btn btn-ghost btn-sm" onClick={() => lastCall.current && run(lastCall.current.action, lastCall.current.prompt)}><IconRefresh />Retry</button>
            <button className="btn btn-sm" onClick={() => setResult(null)}>Discard</button>
            {hasSelection && <button className="btn btn-sm" onClick={() => apply("insert")}>Insert below</button>}
            <button className="btn btn-primary btn-sm" onClick={() => apply(hasSelection ? "replace" : "insert")}>{hasSelection ? "Replace" : "Insert"}</button>
          </div>
        </>
      )}
    </div>
  );
}
