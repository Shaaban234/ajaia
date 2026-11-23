"use client";
import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import { IconBold, IconClearFormat, IconEye, IconItalic, IconList, IconListOrdered, IconPen, IconQuote, IconRedo, IconSparkles, IconUnderline, IconUndo } from "./Icons";

export default function Toolbar({ editor, canEdit, onAi, aiOpen }: { editor: Editor; canEdit: boolean; onAi: () => void; aiOpen: boolean }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      level: ([1, 2, 3] as const).find((l) => e.isActive("heading", { level: l })) ?? 0,
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      quote: e.isActive("blockquote"),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });

  const B = (tip: string, active: boolean, run: () => void, child: React.ReactNode, disabled = false, extra = "") => (
    <button type="button" className={`tb-btn ${active ? "active" : ""} ${extra}`} data-tip={tip} aria-label={tip} aria-pressed={active}
      disabled={disabled || !canEdit} onMouseDown={(e) => e.preventDefault()} onClick={run}>{child}</button>
  );
  const c = () => editor.chain().focus();

  function setStyle(v: string) {
    const level = Number(v);
    if (level === 0) c().setParagraph().run();
    else c().setHeading({ level: level as 1 | 2 | 3 }).run();
  }

  return (
    <div className="docs-toolbar" role="toolbar" aria-label="Formatting">
      {B("Undo (Ctrl+Z)", false, () => c().undo().run(), <IconUndo />, !s.canUndo)}
      {B("Redo (Ctrl+Y)", false, () => c().redo().run(), <IconRedo />, !s.canRedo)}
      <span className="tb-sep" />
      <select className="style-select" value={s.level} disabled={!canEdit} onChange={(e) => setStyle(e.target.value)} aria-label="Text style">
        <option value={0}>Normal text</option>
        <option value={1}>Heading 1</option>
        <option value={2}>Heading 2</option>
        <option value={3}>Heading 3</option>
      </select>
      <span className="tb-sep" />
      {B("Bold (Ctrl+B)", s.bold, () => c().toggleBold().run(), <IconBold />)}
      {B("Italic (Ctrl+I)", s.italic, () => c().toggleItalic().run(), <IconItalic />)}
      {B("Underline (Ctrl+U)", s.underline, () => c().toggleUnderline().run(), <IconUnderline />)}
      <span className="tb-sep" />
      {B("Bulleted list (Ctrl+Shift+8)", s.bullet, () => c().toggleBulletList().run(), <IconList />)}
      {B("Numbered list (Ctrl+Shift+7)", s.ordered, () => c().toggleOrderedList().run(), <IconListOrdered />)}
      {B("Quote", s.quote, () => c().toggleBlockquote().run(), <IconQuote />)}
      {B("Clear formatting (Ctrl+\\)", false, () => c().unsetAllMarks().clearNodes().run(), <IconClearFormat />)}
      <span className="tb-sep" />
      {B("Write with AI (Ctrl+J)", aiOpen, onAi, <><IconSparkles /><span className="hide-sm">Write with AI</span></>, false, "ai")}
      <span className="spacer" />
      <span className={`mode-pill ${canEdit ? "" : "view"}`}>{canEdit ? <><IconPen />Editing</> : <><IconEye />Viewing</>}</span>
    </div>
  );
}
