import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { errorResponse, readJson, requireUser, toView } from "@/lib/api";
import { excerptOf, validateTitle } from "@/lib/content";
import { HttpError } from "@/lib/api";

export async function GET() {
  try {
    const user = await requireUser();
    const docs = await (await getStore()).listForUser(user.id);
    // List view does not need full content.
    // List view sends a short plain-text excerpt for card previews instead of full content.
    return NextResponse.json({
      documents: docs.map((d) => ({ ...toView(d, user.id), content: undefined, excerpt: excerptOf(d.content) })),
    });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await readJson(req).catch(() => ({} as Record<string, unknown>));
    const title = validateTitle(body.title ?? "Untitled document");
    if (!title.ok) throw new HttpError(400, title.error);
    const doc = await (await getStore()).create({ title: title.value, content: "<p></p>", ownerId: user.id });
    return NextResponse.json({ document: toView(doc, user.id) }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
