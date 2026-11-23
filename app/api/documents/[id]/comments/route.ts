import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getStore } from "@/lib/store";
import { errorResponse, HttpError, loadDoc, readJson, requireUser } from "@/lib/api";
import { canEdit } from "@/lib/access";

type Ctx = { params: Promise<{ id: string }> };
const MAX_BODY = 2000;

/** Everyone who can open the document can read its comments. */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const user = await requireUser();
    const doc = await loadDoc((await params).id, user);
    return NextResponse.json({ comments: await (await getStore()).listComments(doc.id) });
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * Start a thread: { body, quote, id? } — editors/owners only, because the client
 * anchors the thread by adding a highlight mark to the document content.
 * Reply: { body, threadId } — anyone with access.
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const user = await requireUser();
    const doc = await loadDoc((await params).id, user);
    const b = await readJson(req);
    const body = typeof b.body === "string" ? b.body.trim() : "";
    if (!body) throw new HttpError(400, "Comment cannot be empty.");
    if (body.length > MAX_BODY) throw new HttpError(413, `Comment is too long (max ${MAX_BODY} characters).`);
    const store = await getStore();

    if (b.threadId !== undefined && b.threadId !== null) {
      const root = typeof b.threadId === "string" ? await store.getComment(b.threadId) : null;
      if (!root || root.documentId !== doc.id || root.threadId !== null) throw new HttpError(404, "Thread not found.");
      const c = await store.addComment({ documentId: doc.id, threadId: root.id, authorId: user.id, body, quote: "" });
      return NextResponse.json({ comment: c }, { status: 201 });
    }

    if (!canEdit(doc, user.id)) throw new HttpError(403, "Only people who can edit can start a comment thread. You can reply to existing ones.");
    const quote = typeof b.quote === "string" ? b.quote.trim().slice(0, 500) : "";
    if (!quote) throw new HttpError(400, "Select some text to comment on.");
    // The client generates the id so it can anchor the highlight before the request returns.
    const id = typeof b.id === "string" && /^[0-9a-f-]{36}$/i.test(b.id) ? b.id : randomUUID();
    if (await store.getComment(id)) throw new HttpError(409, "Comment id already exists.");
    const c = await store.addComment({ id, documentId: doc.id, threadId: null, authorId: user.id, body, quote });
    return NextResponse.json({ comment: c }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
