import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { errorResponse, HttpError, loadDoc, readJson, requireUser, toView } from "@/lib/api";
import { canManage } from "@/lib/access";
import { findUserByEmail } from "@/lib/users";

type Ctx = { params: Promise<{ id: string }> };

/** Grant or change access: { email, role: "viewer" | "editor" } */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const user = await requireUser();
    const doc = await loadDoc((await params).id, user);
    if (!canManage(doc, user.id)) throw new HttpError(403, "Only the owner can share this document.");
    const body = await readJson(req);
    const role = body.role ?? "viewer";
    if (role !== "viewer" && role !== "editor") throw new HttpError(400, 'Role must be "viewer" or "editor".');
    if (typeof body.email !== "string" || !body.email.trim()) throw new HttpError(400, "Enter an email address.");
    const target = findUserByEmail(body.email);
    if (!target) throw new HttpError(404, `No user with email ${body.email.trim()}. Try one of the demo accounts.`);
    if (target.id === doc.ownerId) throw new HttpError(400, "The owner already has full access.");
    const updated = await (await getStore()).upsertShare(doc.id, target.id, role);
    return NextResponse.json({ document: toView(updated!, user.id) });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Revoke access: { userId } */
export async function DELETE(req: Request, { params }: Ctx) {
  try {
    const user = await requireUser();
    const doc = await loadDoc((await params).id, user);
    if (!canManage(doc, user.id)) throw new HttpError(403, "Only the owner can change sharing.");
    const body = await readJson(req);
    if (typeof body.userId !== "string") throw new HttpError(400, "userId is required.");
    const updated = await (await getStore()).removeShare(doc.id, body.userId);
    return NextResponse.json({ document: toView(updated!, user.id) });
  } catch (err) {
    return errorResponse(err);
  }
}
