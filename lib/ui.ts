/** Deterministic avatar color + initials so each demo user is visually distinct. */
const PALETTE = ["#5b4cf0", "#e8692e", "#17905a", "#d63e7c", "#2b86c9", "#a06cd5"];

const FIXED: Record<string, string> = { u_alice: "#17905a", u_bob: "#e8692e", u_carol: "#d63e7c" };

export function avatarColor(seed: string): string {
  if (FIXED[seed]) return FIXED[seed];
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function initials(name: string): string {
  return name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export function relativeTime(iso: string): string {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
