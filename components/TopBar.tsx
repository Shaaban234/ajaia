"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@/lib/types";
import Avatar from "./Avatar";
import { IconFeather, IconLogout } from "./Icons";

export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="Ajaia Docs home">
      <span className="brand-mark"><IconFeather /></span>
      <span className="hide-sm">Ajaia Docs</span>
    </Link>
  );
}

export default function TopBar({ user, children, right }: { user: User; children?: React.ReactNode; right?: React.ReactNode }) {
  const router = useRouter();
  async function signOut() {
    await fetch("/api/session", { method: "DELETE" });
    router.push("/login");
    router.refresh();
  }
  return (
    <header className="topbar editor-top">
      <Brand />
      {children}
      <span className="spacer" />
      {right}
      <div className="user-chip">
        <span className="name">{user.name}</span>
        <Avatar name={user.name} id={user.id} />
      </div>
      <button className="btn btn-ghost btn-sm" onClick={signOut} title="Sign out" aria-label="Sign out">
        <IconLogout />
      </button>
    </header>
  );
}
