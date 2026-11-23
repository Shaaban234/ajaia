"use client";
import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import { IconArrowLeft, IconFile } from "./Icons";

type Heading = { level: number; text: string; pos: number };

/** Docs-style document outline: every H1–H3, indented by level; click to jump. */
export default function Outline({ editor, title, onClose }: { editor: Editor; title: string; onClose: () => void }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const headings: Heading[] = [];
      e.state.doc.descendants((node, pos) => {
        if (node.type.name === "heading") headings.push({ level: node.attrs.level as number, text: node.textContent.trim(), pos });
        return node.type.name !== "heading"; // no need to look inside headings
      });
      // The heading the cursor is in (or the last one above it).
      const at = e.state.selection.from;
      const current = headings.filter((h) => h.pos <= at).pop()?.pos ?? null;
      return { headings: headings.filter((h) => h.text), current };
    },
  });
  const headings = state?.headings ?? [];

  function jump(h: Heading) {
    editor.chain().focus().setTextSelection(h.pos + 1).run();
    const dom = editor.view.nodeDOM(h.pos) as HTMLElement | null;
    dom?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <nav className="outline" aria-label="Document outline">
      <button className="outline-back" onClick={onClose} aria-label="Close outline" title="Close outline"><IconArrowLeft /></button>
      <div className="outline-head">Document outline</div>
      <div className="outline-doc"><IconFile /><span>{title}</span></div>
      {headings.length === 0 ? (
        <p className="outline-empty">Headings you add to the document will appear here.</p>
      ) : (
        <ul className="outline-list">
          {headings.map((h, i) => (
            <li key={`${h.pos}-${i}`}>
              <button className={`lvl-${h.level} ${state?.current === h.pos ? "current" : ""}`} onClick={() => jump(h)} title={h.text}>{h.text}</button>
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
}
