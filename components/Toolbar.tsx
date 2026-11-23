"use client";
import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import { IconBold, IconItalic, IconList, IconListOrdered, IconQuote, IconRedo, IconUnderline, IconUndo } from "./Icons";

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
      quote: e.isActive("blockquote"),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });

  const B = (tip: string, active: boolean, run: () => void, child: React.ReactNode, disabled = false) => (
    <button
      type="button"
      className={`tb-btn ${active ? "active" : ""}`}
      data-tip={tip}
      aria-label={tip}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={run}
    >
      {child}
    </button>
  );
  const c = () => editor.chain().focus();

  return (
    <div className="toolbar-dock">
      <div className="toolbar" role="toolbar" aria-label="Formatting">
        {B("Undo · Ctrl+Z", false, () => c().undo().run(), <IconUndo />, !s.canUndo)}
        {B("Redo · Ctrl+Shift+Z", false, () => c().redo().run(), <IconRedo />, !s.canRedo)}
        <span className="tb-sep" />
        {B("Normal text", !s.h1 && !s.h2 && !s.h3, () => c().setParagraph().run(), <span>Aa</span>)}
        {B("Heading 1", s.h1, () => c().toggleHeading({ level: 1 }).run(), <span>H1</span>)}
        {B("Heading 2", s.h2, () => c().toggleHeading({ level: 2 }).run(), <span>H2</span>)}
        {B("Heading 3", s.h3, () => c().toggleHeading({ level: 3 }).run(), <span>H3</span>)}
        <span className="tb-sep" />
        {B("Bold · Ctrl+B", s.bold, () => c().toggleBold().run(), <IconBold />)}
        {B("Italic · Ctrl+I", s.italic, () => c().toggleItalic().run(), <IconItalic />)}
        {B("Underline · Ctrl+U", s.underline, () => c().toggleUnderline().run(), <IconUnderline />)}
        <span className="tb-sep" />
        {B("Bulleted list", s.bullet, () => c().toggleBulletList().run(), <IconList />)}
        {B("Numbered list", s.ordered, () => c().toggleOrderedList().run(), <IconListOrdered />)}
        {B("Quote", s.quote, () => c().toggleBlockquote().run(), <IconQuote />)}
      </div>
    </div>
  );
}
