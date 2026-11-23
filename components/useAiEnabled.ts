"use client";
import { useEffect, useState } from "react";

let cached: boolean | null = null;

/** Whether the server has an AI key configured (cached for the session). */
export function useAiEnabled(): boolean | null {
  const [enabled, setEnabled] = useState<boolean | null>(cached);
  useEffect(() => {
    if (cached !== null) return;
    fetch("/api/ai").then((r) => (r.ok ? r.json() : { enabled: false })).then((b) => { cached = !!b.enabled; setEnabled(cached); }).catch(() => setEnabled(false));
  }, []);
  return enabled;
}
