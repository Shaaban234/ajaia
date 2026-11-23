import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { errorResponse, HttpError, loadDoc, readJson, requireUser } from "@/lib/api";
import { canEdit, canManage } from "@/lib/access";

type Ctx = { params: Promise<{ id: string; cid: string }> };

async function load(ctx: Ctx) {
  const user = await requireUser();
  const { id, cid } = await ctx.params;
  const doc = await loadDoc(id, user);
  const comment = await (await getStore()).getComment(cid);
  if (!comment || comment.documentId !== doc.id) throw new HttpError(404, "Comment not found.");
  return { user, doc, comment };
}

/** { resolved: boolean } — editors/owners resolve or reopen a thread. */
export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const { user, doc, comment } = await load(ctx);
    if (comment.threadId !== null) throw new HttpError(400, "Only a thread can be resolved.");
    if (!canEdit(doc, user.id)) throw new HttpError(403, "Only people who can edit can resolve comments.");
    const b = await readJson(req);
    if (typeof b.resolved !== "boolean") throw new HttpError(400, "resolved must be true or false.");
    return NextResponse.json({ comment: await (await getStore()).setResolved(comment.id, b.resolved) });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Authors can delete their own comments; the owner can delete any. */
export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    const { user, doc, comment } = await load(ctx);
    if (comment.authorId !== user.id && !canManage(doc, user.id)) throw new HttpError(403, "You can only delete your own comments.");
    await (await getStore()).deleteComment(comment.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
