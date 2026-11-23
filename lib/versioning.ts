import type { Store } from "./store";
import type { DocumentRecord } from "./types";

export const MAX_VERSIONS = 50;
/** Edits by the same person within this window are one "session" (one version), like Docs. */
export const SESSION_MS = 5 * 60_000;

/**
 * Version history stores checkpoints of *previous* states. Before a save replaces
 * content, we snapshot the old content if it hasn't been captured yet and either a
 * different person last edited it or the last checkpoint is older than SESSION_MS.
 */
export async function snapshotBeforeChange(store: Store, doc: DocumentRecord, userId: string, force = false) {
  const versions = await store.listVersions(doc.id);
  const latest = versions[0];
  const alreadyCaptured = latest && new Date(latest.createdAt).getTime() >= new Date(doc.updatedAt).getTime();
  if (alreadyCaptured && !force) return;
  const lastEditor = doc.updatedBy ?? doc.ownerId;
  const stale = !latest || Date.now() - new Date(latest.createdAt).getTime() > SESSION_MS;
  if (force || !latest || lastEditor !== userId || stale) {
    await store.addVersion({ documentId: doc.id, title: doc.title, content: doc.content, authorId: lastEditor, createdAt: alreadyCaptured ? undefined : doc.updatedAt });
    await store.pruneVersions(doc.id, MAX_VERSIONS);
  }
}

/** True when someone else saved after the client's base version: the client would overwrite their work. */
export function isStaleWrite(doc: DocumentRecord, userId: string, baseUpdatedAt: unknown): boolean {
  if (typeof baseUpdatedAt !== "string") return false;
  const base = new Date(baseUpdatedAt).getTime();
  if (Number.isNaN(base)) return false;
  return new Date(doc.updatedAt).getTime() > base && !!doc.updatedBy && doc.updatedBy !== userId;
}
