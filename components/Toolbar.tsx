"use client";
import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";

export default function Toolbar({ editor }: { editor: Editor }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      h1: e.isActive("heading", { level: 1 }),
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });

  const btn = (label: string, title: string, active: boolean, run: () => void, style?: React.CSSProperties) => (
    <button type="button" title={title} aria-label={title} aria-pressed={active} className={active ? "active" : ""} onMouseDown={(e) => e.preventDefault()} onClick={run} style={style}>
      {label}
    </button>
  );

  return (
    <div className="toolbar" role="toolbar" aria-label="Formatting">
      {btn("B", "Bold (Ctrl+B)", s.bold, () => editor.chain().focus().toggleBold().run(), { fontWeight: 700 })}
      {btn("I", "Italic (Ctrl+I)", s.italic, () => editor.chain().focus().toggleItalic().run(), { fontStyle: "italic" })}
      {btn("U", "Underline (Ctrl+U)", s.underline, () => editor.chain().focus().toggleUnderline().run(), { textDecoration: "underline" })}
      <span className="sep" />
      {btn("H1", "Heading 1", s.h1, () => editor.chain().focus().toggleHeading({ level: 1 }).run())}
      {btn("H2", "Heading 2", s.h2, () => editor.chain().focus().toggleHeading({ level: 2 }).run())}
      {btn("H3", "Heading 3", s.h3, () => editor.chain().focus().toggleHeading({ level: 3 }).run())}
      {btn("¶", "Normal text", !s.h1 && !s.h2 && !s.h3, () => editor.chain().focus().setParagraph().run())}
      <span className="sep" />
      {btn("• List", "Bulleted list", s.bullet, () => editor.chain().focus().toggleBulletList().run())}
      {btn("1. List", "Numbered list", s.ordered, () => editor.chain().focus().toggleOrderedList().run())}
      <span className="sep" />
      <button type="button" title="Undo" disabled={!s.canUndo} onClick={() => editor.chain().focus().undo().run()}>↶</button>
      <button type="button" title="Redo" disabled={!s.canRedo} onClick={() => editor.chain().focus().redo().run()}>↷</button>
    </div>
  );
}
