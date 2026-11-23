import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { errorResponse, loadDoc, readJson, requireUser } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };
const ACTIVE_WINDOW_MS = 20_000;

/**
 * Heartbeat (every ~5s from open editors): records that the caller has the document
 * open, and returns who else is active plus the document's latest save, so clients can
 * show presence and pull in remote changes without websockets (works on serverless).
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const user = await requireUser();
    const doc = await loadDoc((await params).id, user);
    const body = await readJson(req).catch(() => ({} as Record<string, unknown>));
    const mode = body.mode === "editing" && doc.role !== "viewer" ? "editing" : "viewing";
    const store = await getStore();
    await store.touchPresence(doc.id, user.id, mode);
    const presence = (await store.listPresence(doc.id, ACTIVE_WINDOW_MS)).filter((p) => p.userId !== user.id);
    return NextResponse.json({ presence, updatedAt: doc.updatedAt, updatedBy: doc.updatedBy ?? null, title: doc.title });
  } catch (err) {
    return errorResponse(err);
  }
}
