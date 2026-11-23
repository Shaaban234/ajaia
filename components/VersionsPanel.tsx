"use client";
import { useEffect, useState } from "react";
import Avatar from "./Avatar";
import { IconHistory, IconX } from "./Icons";
import type { Version } from "@/lib/types";

const NAMES: Record<string, string> = { u_alice: "Alice Khan", u_bob: "Bob Martin", u_carol: "Carol Diaz" };
type Meta = Omit<Version, "content">;

function stamp(iso: string) {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function VersionsPanel({ docId, selectedId, onSelect, onClose, refreshKey }: {
  docId: string; selectedId: string | null; onSelect: (v: Meta | null) => void; onClose: () => void; refreshKey: number;
}) {
  const [versions, setVersions] = useState<Meta[] | null>(null);
  const [current, setCurrent] = useState<{ updatedAt: string; updatedBy: string } | null>(null);

  useEffect(() => {
    fetch(`/api/documents/${docId}/versions`, { cache: "no-store" }).then((r) => r.json()).then((b) => { setVersions(b.versions ?? []); setCurrent(b.current); });
  }, [docId, refreshKey]);

  return (
    <aside className="comments-panel versions-panel" aria-label="Version history">
      <div className="cp-head">
        <IconHistory width={18} /><strong>Version history</strong>
        <span className="spacer" />
        <button className="icon-btn plain" onClick={onClose} aria-label="Close version history"><IconX /></button>
      </div>
      {versions === null ? <div className="cp-empty"><span className="spinner" /></div> : (
        <div className="vlist">
          {current && (
            <button className={`vitem ${selectedId === null ? "active" : ""}`} onClick={() => onSelect(null)}>
              <span className="vdot current" />
              <div>
                <strong>Current version</strong>
                <span className="vtime">{stamp(current.updatedAt)}</span>
                <span className="vwho"><Avatar name={NAMES[current.updatedBy] ?? "?"} id={current.updatedBy} />{NAMES[current.updatedBy] ?? current.updatedBy}</span>
              </div>
            </button>
          )}
          {versions.map((v) => (
            <button key={v.id} className={`vitem ${selectedId === v.id ? "active" : ""}`} onClick={() => onSelect(v)}>
              <span className="vdot" />
              <div>
                <strong>{stamp(v.createdAt)}</strong>
                <span className="vtime">{v.title}</span>
                <span className="vwho"><Avatar name={NAMES[v.authorId] ?? "?"} id={v.authorId} />{NAMES[v.authorId] ?? v.authorId}</span>
              </div>
            </button>
          ))}
          {versions.length === 0 && <div className="cp-empty"><p>No earlier versions yet</p><span className="muted">A version is saved each time a different person starts editing, or after 5 minutes of continued editing.</span></div>}
        </div>
      )}
    </aside>
  );
}
