"use client";
import { useEffect, useRef, useState } from "react";

export type MenuItem =
  | { label: string; onClick: () => void; shortcut?: string; disabled?: boolean; danger?: boolean; icon?: React.ReactNode }
  | "divider";

/** Small accessible dropdown used for the Docs-style menu bar. */
export default function Menu({ label, items }: { label: string; items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);
  return (
    <div className="menu" ref={ref}>
      <button type="button" className={`menu-trigger ${open ? "open" : ""}`} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>{label}</button>
      {open && (
        <div className="menu-pop" role="menu">
          {items.map((it, i) => it === "divider" ? <div key={i} className="menu-div" /> : (
            <button key={i} type="button" role="menuitem" className={`menu-item ${it.danger ? "danger" : ""}`} disabled={it.disabled}
              onMouseDown={(e) => e.preventDefault()} onClick={() => { setOpen(false); it.onClick(); }}>
              <span className="mi-icon">{it.icon}</span>
              <span className="mi-label">{it.label}</span>
              {it.shortcut && <span className="mi-short">{it.shortcut}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
