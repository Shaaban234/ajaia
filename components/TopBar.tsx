"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@/lib/types";

export default function TopBar({ user, children }: { user: User; children?: React.ReactNode }) {
  const router = useRouter();
  async function signOut() {
    await fetch("/api/session", { method: "DELETE" });
    router.push("/login");
    router.refresh();
  }
  return (
    <header className="topbar">
      <Link href="/" className="brand">Ajaia Docs</Link>
      {children}
      <span className="spacer" />
      <span className="muted">{user.name}</span>
      <button className="btn" onClick={signOut}>Sign out</button>
    </header>
  );
}
