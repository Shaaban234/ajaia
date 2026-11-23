import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { errorResponse, HttpError, loadDoc, readJson, requireUser, toView } from "@/lib/api";
import { canEdit, canManage } from "@/lib/access";
import type { LinkAccess } from "@/lib/types";
import { isStaleWrite, snapshotBeforeChange } from "@/lib/versioning";
import { findUserById } from "@/lib/users";
import { MAX_CONTENT_BYTES, sanitizeDocumentHtml, validateTitle } from "@/lib/content";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const user = await requireUser();
    return NextResponse.json({ document: await loadDoc((await params).id, user) });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const user = await requireUser();
    const doc = await loadDoc((await params).id, user);
    const body = await readJson(req);
    const patch: { title?: string; content?: string; linkAccess?: LinkAccess } = {};

    if (body.title !== undefined) {
      if (!canManage(doc, user.id)) throw new HttpError(403, "Only the owner can rename this document.");
      const t = validateTitle(body.title);
      if (!t.ok) throw new HttpError(400, t.error);
      patch.title = t.value;
    }
    if (body.content !== undefined) {
      if (!canEdit(doc, user.id)) throw new HttpError(403, "You have view-only access to this document.");
      if (typeof body.content !== "string") throw new HttpError(400, "Content must be a string.");
      if (Buffer.byteLength(body.content) > MAX_CONTENT_BYTES) throw new HttpError(413, "Document is too large (1 MB limit).");
      patch.content = sanitizeDocumentHtml(body.content);
      // Optimistic concurrency: refuse to silently overwrite someone else's newer save.
      if (isStaleWrite(doc, user.id, body.baseUpdatedAt)) {
        const who = findUserById(doc.updatedBy!)?.name ?? "Someone";
        return NextResponse.json({ error: `${who} edited this document while you were editing.`, conflict: true, document: toView(doc, user.id) }, { status: 409 });
      }
    }
    if (body.linkAccess !== undefined) {
      if (!canManage(doc, user.id)) throw new HttpError(403, "Only the owner can change general access.");
      if (!["restricted", "viewer", "editor"].includes(body.linkAccess as string)) throw new HttpError(400, "Invalid general access setting.");
      patch.linkAccess = body.linkAccess as LinkAccess;
    }
    if (patch.title === undefined && patch.content === undefined && patch.linkAccess === undefined) throw new HttpError(400, "Nothing to update.");

    const store = await getStore();
    if (patch.content !== undefined && patch.content !== doc.content) await snapshotBeforeChange(store, doc, user.id);
    const updated = await store.update(doc.id, { ...patch, updatedBy: patch.content !== undefined ? user.id : undefined });
    if (!updated) throw new HttpError(404, "Document not found.");
    return NextResponse.json({ document: toView(updated, user.id) });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const user = await requireUser();
    const doc = await loadDoc((await params).id, user);
    if (!canManage(doc, user.id)) throw new HttpError(403, "Only the owner can delete this document.");
    await (await getStore()).remove(doc.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
