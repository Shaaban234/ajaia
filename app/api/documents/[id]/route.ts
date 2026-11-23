import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { errorResponse, HttpError, loadDoc, readJson, requireUser, toView } from "@/lib/api";
import { canEdit, canManage } from "@/lib/access";
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
    const patch: { title?: string; content?: string } = {};

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
    }
    if (patch.title === undefined && patch.content === undefined) throw new HttpError(400, "Nothing to update.");

    const updated = await (await getStore()).update(doc.id, patch);
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
