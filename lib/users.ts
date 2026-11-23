import type { User } from "./types";

/**
 * Seeded demo accounts. Auth is intentionally mocked (see ARCHITECTURE.md):
 * every account uses the same demo password so reviewers can switch users
 * quickly to test sharing.
 */
export const USERS: User[] = [
  { id: "u_alice", name: "Alice Khan", email: "alice@ajaia.test" },
  { id: "u_bob", name: "Bob Martin", email: "bob@ajaia.test" },
  { id: "u_carol", name: "Carol Diaz", email: "carol@ajaia.test" },
];

export const DEMO_PASSWORD = "demo1234";

export function findUserById(id: string): User | undefined {
  return USERS.find((u) => u.id === id);
}

export function findUserByEmail(email: string): User | undefined {
  const e = email.trim().toLowerCase();
  return USERS.find((u) => u.email === e);
}
