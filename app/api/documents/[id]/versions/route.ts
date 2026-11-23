import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { errorResponse, loadDoc, requireUser } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

/** Version list (newest first, no content). Anyone with access can see history. */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const user = await requireUser();
    const doc = await loadDoc((await params).id, user);
    return NextResponse.json({ versions: await (await getStore()).listVersions(doc.id), current: { updatedAt: doc.updatedAt, updatedBy: doc.updatedBy ?? doc.ownerId } });
  } catch (err) {
    return errorResponse(err);
  }
}
