"use client";
import { useEffect, useRef, useState } from "react";

/** Toolbar dropdown: a trigger button and a panel that closes on outside click / Escape. */
export default function Popover({
  trigger, tip, children, disabled, active, className = "", align = "left",
}: {
  trigger: React.ReactNode;
  tip: string;
  children: (close: () => void) => React.ReactNode;
  disabled?: boolean;
  active?: boolean;
  className?: string;
  align?: "left" | "right";
}) {
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
    <div className="pop" ref={ref}>
      <button type="button" className={`tb-btn ${open || active ? "active" : ""} ${className}`} data-tip={open ? undefined : tip} aria-label={tip}
        aria-haspopup="true" aria-expanded={open} disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={() => setOpen((o) => !o)}>
        {trigger}
      </button>
      {open && <div className={`pop-panel ${align === "right" ? "right" : ""}`} onMouseDown={(e) => { if ((e.target as HTMLElement).tagName !== "INPUT") e.preventDefault(); }}>{children(() => setOpen(false))}</div>}
    </div>
  );
}
