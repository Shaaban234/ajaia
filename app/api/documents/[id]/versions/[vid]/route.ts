import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { errorResponse, HttpError, loadDoc, requireUser, toView } from "@/lib/api";
import { canEdit } from "@/lib/access";
import { snapshotBeforeChange } from "@/lib/versioning";

type Ctx = { params: Promise<{ id: string; vid: string }> };

async function load(ctx: Ctx) {
  const user = await requireUser();
  const { id, vid } = await ctx.params;
  const doc = await loadDoc(id, user);
  const version = await (await getStore()).getVersion(vid);
  if (!version || version.documentId !== doc.id) throw new HttpError(404, "Version not found.");
  return { user, doc, version };
}

/** Preview one version's content. */
export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { version } = await load(ctx);
    return NextResponse.json({ version });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Restore: the current state is checkpointed first, so a restore can itself be undone. */
export async function POST(_req: Request, ctx: Ctx) {
  try {
    const { user, doc, version } = await load(ctx);
    if (!canEdit(doc, user.id)) throw new HttpError(403, "Only people who can edit can restore a version.");
    const store = await getStore();
    await snapshotBeforeChange(store, doc, user.id, true);
    const updated = await store.update(doc.id, { content: version.content, updatedBy: user.id });
    return NextResponse.json({ document: toView(updated!, user.id) });
  } catch (err) {
    return errorResponse(err);
  }
}
