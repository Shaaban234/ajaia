import { NextResponse } from "next/server";
import { currentUser } from "./session";
import { getStore } from "./store";
import { roleFor } from "./access";
import type { DocumentRecord, DocumentView, User } from "./types";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function errorResponse(err: unknown) {
  if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
  console.error(err);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}

export async function requireUser(): Promise<User> {
  const user = await currentUser();
  if (!user) throw new HttpError(401, "Please sign in.");
  return user;
}

/** Loads a document and the caller's role, hiding existence from users without access. */
export async function loadDoc(id: string, user: User): Promise<DocumentView> {
  const doc = await (await getStore()).get(id);
  const role = doc ? roleFor(doc, user.id) : null;
  if (!doc || !role) throw new HttpError(404, "Document not found.");
  return { ...doc, role };
}

export function toView(doc: DocumentRecord, userId: string): DocumentView {
  return { ...doc, role: roleFor(doc, userId)! };
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    if (body && typeof body === "object") return body as Record<string, unknown>;
  } catch {}
  throw new HttpError(400, "Request body must be JSON.");
}
