"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import Popover from "./Popover";
import {
  IconAlignCenter, IconAlignJustify, IconAlignLeft, IconAlignRight, IconBold, IconCaret, IconCheck, IconChecklist, IconChevronUp,
  IconClearFormat, IconEye, IconHighlight, IconImage, IconIndent, IconItalic, IconLineSpacing, IconLink, IconList, IconListOrdered,
  IconCommentAdd, IconMinus, IconOutdent, IconPaint, IconPen, IconPlus, IconPrint, IconQuote, IconRedo, IconSearch, IconSparkles, IconSpell, IconUnderline, IconUndo,
} from "./Icons";

export type Command = { label: string; run: () => void; hint?: string; disabled?: boolean };

const FONTS = [
  { label: "Inter", value: "" },
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Fraunces", value: "'Fraunces Variable', Georgia, serif" },
  { label: "Times New Roman", value: "'Times New Roman', serif" },
  { label: "Courier New", value: "'Courier New', monospace" },
  { label: "Verdana", value: "Verdana, sans-serif" },
  { label: "Trebuchet MS", value: "'Trebuchet MS', sans-serif" },
];
const DEFAULT_SIZE = 11; // pt, like Docs; the page base font is 11pt
const SIZES = [8, 9, 10, 11, 12, 14, 18, 24, 30, 36, 48];
const COLORS = [
  "#000000", "#434343", "#666666", "#999999", "#b7b7b7", "#d9d9d9", "#efefef", "#ffffff",
  "#980000", "#ff0000", "#ff9900", "#ffff00", "#00ff00", "#00ffff", "#4a86e8", "#0000ff", "#9900ff", "#ff00ff",
  "#e6b8af", "#f4cccc", "#fce5cd", "#fff2cc", "#d9ead3", "#d0e0e3", "#c9daf8", "#cfe2f3", "#d9d2e9", "#ead1dc",
  "#cc4125", "#e06666", "#f6b26b", "#ffd966", "#93c47d", "#76a5af", "#6d9eeb", "#6fa8dc", "#8e7cc3", "#c27ba0",
];
const ZOOMS = [50, 75, 90, 100, 125, 150];
const SPACINGS = [{ label: "Single", v: "1.15" }, { label: "1.5", v: "1.5" }, { label: "Double", v: "2" }, { label: "Compact", v: "1" }];

export interface ToolbarProps {
  editor: Editor;
  canEdit: boolean;
  mode: "editing" | "viewing";
  onModeChange: (m: "editing" | "viewing") => void;
  zoom: number;
  onZoom: (z: number) => void;
  spellcheck: boolean;
  onSpellcheck: (v: boolean) => void;
  onAi: () => void;
  aiOpen: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
  commands: Command[];
  onComment: () => void;
}

function Swatches({ onPick, onReset, resetLabel }: { onPick: (c: string) => void; onReset: () => void; resetLabel: string }) {
  return (
    <div className="swatch-panel">
      <button type="button" className="pop-item" onClick={onReset}><IconClearFormat width={16} />{resetLabel}</button>
      <div className="swatches">
        {COLORS.map((c) => <button key={c} type="button" className="swatch" style={{ background: c }} title={c} aria-label={c} onClick={() => onPick(c)} />)}
      </div>
    </div>
  );
}

function UrlForm({ placeholder, initial, submit, onRemove }: { placeholder: string; initial?: string; submit: (url: string) => void; onRemove?: () => void }) {
  const [url, setUrl] = useState(initial ?? "");
  const [err, setErr] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <form className="url-form" onSubmit={(e) => {
      e.preventDefault();
      const v = url.trim();
      if (!/^https?:\/\/\S+$/i.test(v)) return setErr("Enter a full http(s) URL.");
      submit(v);
    }}>
      <input ref={ref} className="input" placeholder={placeholder} value={url} onChange={(e) => { setUrl(e.target.value); setErr(""); }} />
      <div className="url-actions">
        {onRemove && <button type="button" className="btn btn-sm btn-ghost" onClick={onRemove}>Remove</button>}
        <button className="btn btn-sm btn-primary">Apply</button>
      </div>
      {err && <span className="error-text">{err}</span>}
    </form>
  );
}

export default function Toolbar(p: ToolbarProps) {
  const { editor } = p;
  const can = p.canEdit && p.mode === "editing";
  const [painter, setPainter] = useState<null | { marks: ReturnType<Editor["state"]["selection"]["$from"]["marks"]> }>(null);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [sizeDraft, setSizeDraft] = useState<string | null>(null);

  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const ts = e.getAttributes("textStyle");
      return {
        bold: e.isActive("bold"),
        italic: e.isActive("italic"),
        underline: e.isActive("underline"),
        level: ([1, 2, 3] as const).find((l) => e.isActive("heading", { level: l })) ?? 0,
        bullet: e.isActive("bulletList"),
        ordered: e.isActive("orderedList"),
        task: e.isActive("taskList"),
        quote: e.isActive("blockquote"),
        link: e.isActive("link"),
        href: (e.getAttributes("link").href as string | undefined) ?? "",
        align: (["center", "right", "justify"] as const).find((a) => e.isActive({ textAlign: a })) ?? "left",
        font: (ts.fontFamily as string | undefined) ?? "",
        size: ts.fontSize ? parseFloat(ts.fontSize as string) : null,
        color: (ts.color as string | undefined) ?? "",
        canUndo: e.can().undo(),
        canRedo: e.can().redo(),
        canSink: e.can().sinkListItem("listItem") || e.can().sinkListItem("taskItem"),
        canLift: e.can().liftListItem("listItem") || e.can().liftListItem("taskItem"),
      };
    },
  });

  // Paint format: copy marks, then apply them to the next non-empty selection.
  useEffect(() => {
    if (!painter) return;
    const apply = () => {
      const { from, to, empty } = editor.state.selection;
      if (empty) return;
      let tr = editor.state.tr;
      tr = tr.removeMark(from, to);
      painter.marks.forEach((m) => { tr = tr.addMark(from, to, m); });
      editor.view.dispatch(tr);
      setPainter(null);
    };
    const onUp = () => setTimeout(apply, 0);
    const dom = editor.view.dom;
    dom.addEventListener("mouseup", onUp);
    dom.classList.add("painting");
    return () => { dom.removeEventListener("mouseup", onUp); dom.classList.remove("painting"); };
  }, [painter, editor]);

  const c = () => editor.chain().focus();
  const B = (tip: string, active: boolean, run: () => void, child: React.ReactNode, disabled = false, extra = "") => (
    <button type="button" className={`tb-btn ${active ? "active" : ""} ${extra}`} data-tip={tip} aria-label={tip} aria-pressed={active}
      disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={run}>{child}</button>
  );

  /** Selects the whole current block when nothing is selected (for block-ish text styles like line spacing). */
  function withBlockSelection(fn: (ch: ReturnType<Editor["chain"]>) => ReturnType<Editor["chain"]>) {
    const { empty, $from } = editor.state.selection;
    let ch = editor.chain().focus();
    if (empty && $from.parent.isTextblock) ch = ch.setTextSelection({ from: $from.start(), to: $from.end() });
    fn(ch).run();
  }

  const currentSize = s.size ? Math.round(s.size * 0.75 * 10) / 10 : DEFAULT_SIZE; // px → pt
  function setSize(pt: number) {
    const v = Math.min(Math.max(Math.round(pt), 1), 96);
    c().setFontSize(`${Math.round(v / 0.75)}px`).run();
    setSizeDraft(null);
  }

  const allCommands: Command[] = useMemo(() => [
    { label: "Bold", hint: "Ctrl+B", run: () => c().toggleBold().run(), disabled: !can },
    { label: "Italic", hint: "Ctrl+I", run: () => c().toggleItalic().run(), disabled: !can },
    { label: "Underline", hint: "Ctrl+U", run: () => c().toggleUnderline().run(), disabled: !can },
    { label: "Heading 1", run: () => c().setHeading({ level: 1 }).run(), disabled: !can },
    { label: "Heading 2", run: () => c().setHeading({ level: 2 }).run(), disabled: !can },
    { label: "Heading 3", run: () => c().setHeading({ level: 3 }).run(), disabled: !can },
    { label: "Normal text", run: () => c().setParagraph().run(), disabled: !can },
    { label: "Bulleted list", run: () => c().toggleBulletList().run(), disabled: !can },
    { label: "Numbered list", run: () => c().toggleOrderedList().run(), disabled: !can },
    { label: "Checklist", run: () => c().toggleTaskList().run(), disabled: !can },
    { label: "Align center", run: () => c().setTextAlign("center").run(), disabled: !can },
    { label: "Align left", run: () => c().setTextAlign("left").run(), disabled: !can },
    { label: "Align right", run: () => c().setTextAlign("right").run(), disabled: !can },
    { label: "Justify", run: () => c().setTextAlign("justify").run(), disabled: !can },
    { label: "Clear formatting", hint: "Ctrl+\\", run: () => c().unsetAllMarks().clearNodes().run(), disabled: !can },
    { label: "Insert horizontal line", run: () => c().setHorizontalRule().run(), disabled: !can },
    { label: "Print", hint: "Ctrl+P", run: () => window.print() },
    { label: "Write with AI", hint: "Ctrl+J", run: p.onAi, disabled: !can },
    { label: p.spellcheck ? "Turn off spellcheck" : "Turn on spellcheck", run: () => p.onSpellcheck(!p.spellcheck) },
    ...ZOOMS.map((z) => ({ label: `Zoom ${z}%`, run: () => p.onZoom(z) })),
    ...p.commands,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [can, p.commands, p.spellcheck, p.onAi, p.onSpellcheck, p.onZoom, editor]);

  const matches = query.trim() ? allCommands.filter((x) => x.label.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 8) : [];
  const AlignIcon = ({ left: IconAlignLeft, center: IconAlignCenter, right: IconAlignRight, justify: IconAlignJustify } as const)[s.align] ?? IconAlignLeft;
  const fontLabel = FONTS.find((f) => f.value === s.font)?.label ?? (s.font.split(",")[0].replace(/['"]/g, "") || "Inter");

  return (
    <div className="docs-toolbar" role="toolbar" aria-label="Formatting">
      <div className="menu-search">
        <IconSearch />
        <input placeholder="Menus" aria-label="Search menus" value={query} onFocus={() => setSearchOpen(true)} onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && matches[0] && !matches[0].disabled) { matches[0].run(); setQuery(""); (e.target as HTMLInputElement).blur(); }
            if (e.key === "Escape") { setQuery(""); (e.target as HTMLInputElement).blur(); }
          }} />
        {searchOpen && query.trim() && (
          <div className="pop-panel search-results">
            {matches.length === 0 ? <div className="pop-empty">No matching commands</div> : matches.map((m) => (
              <button key={m.label} type="button" className="pop-item" disabled={m.disabled} onMouseDown={(e) => e.preventDefault()} onClick={() => { m.run(); setQuery(""); setSearchOpen(false); }}>
                <span style={{ flex: 1 }}>{m.label}</span>{m.hint && <span className="mi-short">{m.hint}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {B("Undo (Ctrl+Z)", false, () => c().undo().run(), <IconUndo />, !can || !s.canUndo)}
      {B("Redo (Ctrl+Y)", false, () => c().redo().run(), <IconRedo />, !can || !s.canRedo)}
      {B("Print (Ctrl+P)", false, () => window.print(), <IconPrint />)}
      {B(p.spellcheck ? "Spellcheck on" : "Spellcheck off", p.spellcheck, () => p.onSpellcheck(!p.spellcheck), <IconSpell />)}
      {B(painter ? "Paint format: select text to apply" : "Paint format", !!painter, () => setPainter(painter ? null : { marks: editor.state.selection.$from.marks() }), <IconPaint />, !can)}

      <Popover tip="Zoom" trigger={<span className="tb-text">{p.zoom}%<IconCaret className="caret" /></span>}>
        {(close) => ZOOMS.map((z) => <button key={z} type="button" className="pop-item" onClick={() => { p.onZoom(z); close(); }}>{z === p.zoom ? <IconCheck width={15} /> : <span style={{ width: 15 }} />}{z}%</button>)}
      </Popover>
      <span className="tb-sep" />

      <Popover tip="Styles" disabled={!can} trigger={<span className="tb-text wide">{["Normal text", "Heading 1", "Heading 2", "Heading 3"][s.level]}<IconCaret className="caret" /></span>}>
        {(close) => (
          <>
            <button type="button" className="pop-item style-p" onClick={() => { c().setParagraph().run(); close(); }}>Normal text</button>
            <button type="button" className="pop-item style-h1" onClick={() => { c().setHeading({ level: 1 }).run(); close(); }}>Heading 1</button>
            <button type="button" className="pop-item style-h2" onClick={() => { c().setHeading({ level: 2 }).run(); close(); }}>Heading 2</button>
            <button type="button" className="pop-item style-h3" onClick={() => { c().setHeading({ level: 3 }).run(); close(); }}>Heading 3</button>
          </>
        )}
      </Popover>
      <span className="tb-sep" />

      <Popover tip="Font" disabled={!can} trigger={<span className="tb-text wide font-label">{fontLabel}<IconCaret className="caret" /></span>}>
        {(close) => FONTS.map((f) => (
          <button key={f.label} type="button" className="pop-item" style={{ fontFamily: f.value || "var(--sans)" }}
            onClick={() => { if (f.value) c().setFontFamily(f.value).run(); else c().unsetFontFamily().run(); close(); }}>
            {(s.font === f.value) ? <IconCheck width={15} /> : <span style={{ width: 15 }} />}{f.label}
          </button>
        ))}
      </Popover>
      <span className="tb-sep" />

      {B("Decrease font size (Ctrl+Shift+,)", false, () => setSize((SIZES.slice().reverse().find((x) => x < currentSize) ?? currentSize - 1)), <IconMinus />, !can)}
      <input className="size-input" aria-label="Font size" disabled={!can} value={sizeDraft ?? String(currentSize)}
        onChange={(e) => setSizeDraft(e.target.value.replace(/[^\d.]/g, ""))}
        onBlur={() => { if (sizeDraft) setSize(Number(sizeDraft)); setSizeDraft(null); }}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (sizeDraft) setSize(Number(sizeDraft)); } }} />
      {B("Increase font size (Ctrl+Shift+.)", false, () => setSize(SIZES.find((x) => x > currentSize) ?? currentSize + 1), <IconPlus />, !can)}
      <span className="tb-sep" />

      {B("Bold (Ctrl+B)", s.bold, () => c().toggleBold().run(), <IconBold />, !can)}
      {B("Italic (Ctrl+I)", s.italic, () => c().toggleItalic().run(), <IconItalic />, !can)}
      {B("Underline (Ctrl+U)", s.underline, () => c().toggleUnderline().run(), <IconUnderline />, !can)}
      <Popover tip="Text color" disabled={!can} trigger={<span className="color-a"><span>A</span><i style={{ background: s.color || "#1f1f1f" }} /></span>}>
        {(close) => <Swatches resetLabel="Reset color" onReset={() => { c().unsetColor().run(); close(); }} onPick={(col) => { c().setColor(col).run(); close(); }} />}
      </Popover>
      <Popover tip="Highlight color" disabled={!can} trigger={<IconHighlight />}>
        {(close) => <Swatches resetLabel="None" onReset={() => { c().unsetHighlight().run(); close(); }} onPick={(col) => { c().setHighlight({ color: col }).run(); close(); }} />}
      </Popover>
      <span className="tb-sep" />

      <Popover tip="Insert link (Ctrl+K)" disabled={!can} active={s.link} trigger={<IconLink />}>
        {(close) => <UrlForm placeholder="Paste a link, e.g. https://ajaia.com" initial={s.href}
          onRemove={s.link ? () => { c().extendMarkRange("link").unsetLink().run(); close(); } : undefined}
          submit={(url) => {
            if (editor.state.selection.empty && !s.link) c().insertContent({ type: "text", text: url, marks: [{ type: "link", attrs: { href: url } }] }).run();
            else c().extendMarkRange("link").setLink({ href: url }).run();
            close();
          }} />}
      </Popover>
      <Popover tip="Insert image (by URL)" disabled={!can} trigger={<IconImage />}>
        {(close) => <UrlForm placeholder="Image URL, e.g. https://…/photo.png" submit={(url) => { c().setImage({ src: url }).run(); close(); }} />}
      </Popover>
      {B("Add comment (Ctrl+Alt+M)", false, p.onComment, <IconCommentAdd />, !p.canEdit)}
      <span className="tb-sep" />

      <Popover tip="Align & indent" disabled={!can} trigger={<span className="tb-text"><AlignIcon width={18} height={18} /><IconCaret className="caret" /></span>}>
        {(close) => (
          <div className="align-row">
            {([["left", IconAlignLeft, "Left"], ["center", IconAlignCenter, "Center"], ["right", IconAlignRight, "Right"], ["justify", IconAlignJustify, "Justify"]] as const).map(([a, I, label]) => (
              <button key={a} type="button" className={`tb-btn ${s.align === a ? "active" : ""}`} data-tip={label} aria-label={`Align ${label}`} onClick={() => { c().setTextAlign(a).run(); close(); }}><I /></button>
            ))}
          </div>
        )}
      </Popover>
      <Popover tip="Line spacing" disabled={!can} trigger={<IconLineSpacing />}>
        {(close) => SPACINGS.map((sp) => (
          <button key={sp.v} type="button" className="pop-item" onClick={() => { withBlockSelection((ch) => ch.setLineHeight(sp.v)); close(); }}>{sp.label}</button>
        ))}
      </Popover>
      {B("Checklist (Ctrl+Shift+9)", s.task, () => c().toggleTaskList().run(), <IconChecklist />, !can)}
      {B("Bulleted list (Ctrl+Shift+8)", s.bullet, () => c().toggleBulletList().run(), <IconList />, !can)}
      {B("Numbered list (Ctrl+Shift+7)", s.ordered, () => c().toggleOrderedList().run(), <IconListOrdered />, !can)}
      {B("Decrease indent", false, () => { if (!c().liftListItem("listItem").run()) c().liftListItem("taskItem").run(); }, <IconOutdent />, !can || !s.canLift)}
      {B("Increase indent", false, () => { if (!c().sinkListItem("listItem").run()) c().sinkListItem("taskItem").run(); }, <IconIndent />, !can || !s.canSink)}
      {B("Quote", s.quote, () => c().toggleBlockquote().run(), <IconQuote />, !can)}
      {B("Clear formatting (Ctrl+\\)", false, () => c().unsetAllMarks().clearNodes().run(), <IconClearFormat />, !can)}
      <span className="tb-sep" />
      {B("Write with AI (Ctrl+J)", p.aiOpen, p.onAi, <><IconSparkles /><span className="ai-label">AI</span></>, !can, "ai")}

      <span className="spacer" />
      {p.canEdit ? (
        <Popover tip="Mode" align="right" className="mode-btn" trigger={<span className="tb-text mode">{p.mode === "editing" ? <><IconPen width={17} />Editing</> : <><IconEye width={17} />Viewing</>}<IconCaret className="caret" /></span>}>
          {(close) => (
            <>
              <button type="button" className="pop-item tall" onClick={() => { p.onModeChange("editing"); close(); }}><IconPen width={18} /><span><strong>Editing</strong><small>Edit document directly</small></span></button>
              <button type="button" className="pop-item tall" onClick={() => { p.onModeChange("viewing"); close(); }}><IconEye width={18} /><span><strong>Viewing</strong><small>Read or print final document</small></span></button>
            </>
          )}
        </Popover>
      ) : (
        <span className="mode-pill view"><IconEye />Viewing</span>
      )}
      <span className="tb-sep" />
      {B(p.collapsed ? "Show menus (Ctrl+Shift+F)" : "Hide the menus (Ctrl+Shift+F)", false, p.onToggleCollapse, <IconChevronUp style={{ transform: p.collapsed ? "rotate(180deg)" : undefined, transition: "transform .2s" }} />)}
    </div>
  );
}
