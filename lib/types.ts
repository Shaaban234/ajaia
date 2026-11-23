export type Role = "owner" | "editor" | "viewer";
export type ShareRole = Exclude<Role, "owner">;

export interface User {
  id: string;
  name: string;
  email: string;
}

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
  createdAt: string;
  updatedAt: string;
}

/** What the API returns to a client: the record plus the caller's role. */
export interface DocumentView extends DocumentRecord {
  role: Role;
}
