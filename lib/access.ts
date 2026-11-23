import type { DocumentRecord, Role } from "./types";

/** Returns the caller's role on a document, or null if they have no access. */
export function roleFor(doc: DocumentRecord, userId: string): Role | null {
  if (doc.ownerId === userId) return "owner";
  const share = doc.shares.find((s) => s.userId === userId);
  if (share) return share.role;
  // "Anyone with the link" applies to any signed-in user who opens the document URL.
  const link = doc.linkAccess ?? "restricted";
  return link === "restricted" ? null : link;
}

export function canView(doc: DocumentRecord, userId: string): boolean {
  return roleFor(doc, userId) !== null;
}

export function canEdit(doc: DocumentRecord, userId: string): boolean {
  const role = roleFor(doc, userId);
  return role === "owner" || role === "editor";
}

/** Only the owner can rename, delete, or change who has access. */
export function canManage(doc: DocumentRecord, userId: string): boolean {
  return roleFor(doc, userId) === "owner";
}
