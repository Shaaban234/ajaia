import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { findUserById } from "./users";
import type { User } from "./types";

export const SESSION_COOKIE = "ajaia_session";

function secret(): string {
  return process.env.SESSION_SECRET || "dev-only-secret-change-me";
}

function sign(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export function encodeSession(userId: string): string {
  return `${userId}.${sign(userId)}`;
}

export function decodeSession(token: string | undefined): string | null {
  if (!token) return null;
  const i = token.lastIndexOf(".");
  if (i < 1) return null;
  const userId = token.slice(0, i);
  const sig = Buffer.from(token.slice(i + 1));
  const expected = Buffer.from(sign(userId));
  if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) return null;
  return userId;
}

export async function currentUser(): Promise<User | null> {
  const jar = await cookies();
  const id = decodeSession(jar.get(SESSION_COOKIE)?.value);
  return id ? findUserById(id) ?? null : null;
}
