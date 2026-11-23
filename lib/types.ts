export type Role = "owner" | "editor" | "viewer";
export type ShareRole = Exclude<Role, "owner">;

export interface User {
  id: string;
  name: string;
  email: string;
}

/** General access: who else can open the document with its link. */
export type LinkAccess = "restricted" | "viewer" | "editor";

export interface Share {
  userId: string;
  role: ShareRole;
}

export interface DocumentRecord {
  id: string;
  title: string;
  /** Sanitized HTML produced by the TipTap editor. */
  content: string;
  ownerId: string;
  shares: Share[];
  /** Defaults to "restricted" (only the owner and people explicitly shared with). */
  linkAccess?: LinkAccess;
  /** Who made the last content change (for live updates and conflict messages). */
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  id: string;
  documentId: string;
  /** null for a thread's first comment; otherwise the id of the thread root. */
  threadId: string | null;
  authorId: string;
  body: string;
  /** The text that was selected when the thread started (root comments only). */
  quote: string;
  resolved: boolean;
  createdAt: string;
}

export interface Version {
  id: string;
  documentId: string;
  title: string;
  content: string;
  authorId: string;
  createdAt: string;
}

export interface Presence {
  userId: string;
  mode: "viewing" | "editing";
  lastSeen: string;
}

/** What the API returns to a client: the record plus the caller's role. */
export interface DocumentView extends DocumentRecord {
  role: Role;
}
