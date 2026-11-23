import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Comment, DocumentRecord, LinkAccess, Presence, Share, ShareRole, Version } from "./types";

/**
 * Storage abstraction. Two implementations:
 *  - JsonFileStore: zero-setup local development and tests (.data/db.json)
 *  - PgStore: Postgres for the deployed build (selected when DATABASE_URL is set)
 * Route handlers only depend on this interface.
 */
export interface Store {
  listForUser(userId: string): Promise<DocumentRecord[]>;
  get(id: string): Promise<DocumentRecord | null>;
  create(input: { title: string; content: string; ownerId: string }): Promise<DocumentRecord>;
  update(id: string, patch: { title?: string; content?: string; linkAccess?: LinkAccess; updatedBy?: string }): Promise<DocumentRecord | null>;
  remove(id: string): Promise<boolean>;
  upsertShare(id: string, userId: string, role: ShareRole): Promise<DocumentRecord | null>;
  removeShare(id: string, userId: string): Promise<DocumentRecord | null>;
  listComments(documentId: string): Promise<Comment[]>;
  getComment(id: string): Promise<Comment | null>;
  addComment(input: { id?: string; documentId: string; threadId: string | null; authorId: string; body: string; quote: string }): Promise<Comment>;
  setResolved(id: string, resolved: boolean): Promise<Comment | null>;
  /** Deleting a thread root deletes its replies. */
  deleteComment(id: string): Promise<boolean>;
  /** Newest first, without content. */
  listVersions(documentId: string): Promise<Omit<Version, "content">[]>;
  getVersion(id: string): Promise<Version | null>;
  addVersion(input: { documentId: string; title: string; content: string; authorId: string; createdAt?: string }): Promise<Version>;
  /** Keep only the newest `keep` versions. */
  pruneVersions(documentId: string, keep: number): Promise<void>;
  touchPresence(documentId: string, userId: string, mode: Presence["mode"]): Promise<void>;
  /** Users seen within the last `withinMs`. */
  listPresence(documentId: string, withinMs: number): Promise<Presence[]>;
}

function now() {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// JSON file store
// ---------------------------------------------------------------------------
interface JsonDb {
  documents: DocumentRecord[];
  comments?: Comment[];
  versions?: Version[];
  presence?: (Presence & { documentId: string })[];
}

export class JsonFileStore implements Store {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private file: string) {}

  private async read(): Promise<JsonDb> {
    try {
      return JSON.parse(await fs.readFile(this.file, "utf8")) as JsonDb;
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return { documents: [] };
      throw err;
    }
  }

  private async write(db: JsonDb) {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(db, null, 2));
    await fs.rename(tmp, this.file); // atomic replace
  }

  /** Serialize read-modify-write cycles so concurrent requests don't clobber each other. */
  private mutate<T>(fn: (db: JsonDb) => T): Promise<T> {
    const run = this.queue.then(async () => {
      const db = await this.read();
      const result = fn(db);
      await this.write(db);
      return result;
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  async listForUser(userId: string) {
    const db = await this.read();
    return db.documents
      .filter((d) => d.ownerId === userId || d.shares.some((s) => s.userId === userId))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async get(id: string) {
    const db = await this.read();
    return db.documents.find((d) => d.id === id) ?? null;
  }

  create(input: { title: string; content: string; ownerId: string }) {
    return this.mutate((db) => {
      const t = now();
      const doc: DocumentRecord = { id: randomUUID(), ...input, shares: [], createdAt: t, updatedAt: t };
      db.documents.push(doc);
      return doc;
    });
  }

  update(id: string, patch: { title?: string; content?: string; linkAccess?: LinkAccess; updatedBy?: string }) {
    return this.mutate((db) => {
      const doc = db.documents.find((d) => d.id === id);
      if (!doc) return null;
      if (patch.title !== undefined) doc.title = patch.title;
      if (patch.content !== undefined) { doc.content = patch.content; if (patch.updatedBy) doc.updatedBy = patch.updatedBy; }
      if (patch.linkAccess !== undefined) doc.linkAccess = patch.linkAccess;
      doc.updatedAt = now();
      return doc;
    });
  }

  remove(id: string) {
    return this.mutate((db) => {
      const before = db.documents.length;
      db.documents = db.documents.filter((d) => d.id !== id);
      db.comments = (db.comments ?? []).filter((c) => c.documentId !== id);
      db.versions = (db.versions ?? []).filter((v) => v.documentId !== id);
      return db.documents.length < before;
    });
  }

  upsertShare(id: string, userId: string, role: ShareRole) {
    return this.mutate((db) => {
      const doc = db.documents.find((d) => d.id === id);
      if (!doc) return null;
      const existing = doc.shares.find((s) => s.userId === userId);
      if (existing) existing.role = role;
      else doc.shares.push({ userId, role });
      return doc;
    });
  }

  removeShare(id: string, userId: string) {
    return this.mutate((db) => {
      const doc = db.documents.find((d) => d.id === id);
      if (!doc) return null;
      doc.shares = doc.shares.filter((s) => s.userId !== userId);
      return doc;
    });
  }

  async listVersions(documentId: string) {
    const db = await this.read();
    return (db.versions ?? []).filter((v) => v.documentId === documentId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(({ content: _c, ...rest }) => rest); // eslint-disable-line @typescript-eslint/no-unused-vars
  }

  async getVersion(id: string) {
    const db = await this.read();
    return (db.versions ?? []).find((v) => v.id === id) ?? null;
  }

  addVersion(input: { documentId: string; title: string; content: string; authorId: string; createdAt?: string }) {
    return this.mutate((db) => {
      const v: Version = { id: randomUUID(), ...input, createdAt: input.createdAt ?? now() };
      (db.versions ??= []).push(v);
      return v;
    });
  }

  pruneVersions(documentId: string, keep: number) {
    return this.mutate((db) => {
      const mine = (db.versions ?? []).filter((v) => v.documentId === documentId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const drop = new Set(mine.slice(keep).map((v) => v.id));
      db.versions = (db.versions ?? []).filter((v) => !drop.has(v.id));
    });
  }

  touchPresence(documentId: string, userId: string, mode: Presence["mode"]) {
    return this.mutate((db) => {
      const list = (db.presence ??= []);
      const p = list.find((x) => x.documentId === documentId && x.userId === userId);
      if (p) { p.mode = mode; p.lastSeen = now(); } else list.push({ documentId, userId, mode, lastSeen: now() });
    });
  }

  async listPresence(documentId: string, withinMs: number) {
    const db = await this.read();
    const cutoff = Date.now() - withinMs;
    return (db.presence ?? []).filter((p) => p.documentId === documentId && new Date(p.lastSeen).getTime() >= cutoff)
      .map(({ userId, mode, lastSeen }) => ({ userId, mode, lastSeen }));
  }

  async listComments(documentId: string) {
    const db = await this.read();
    return (db.comments ?? []).filter((c) => c.documentId === documentId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async getComment(id: string) {
    const db = await this.read();
    return (db.comments ?? []).find((c) => c.id === id) ?? null;
  }

  addComment(input: { id?: string; documentId: string; threadId: string | null; authorId: string; body: string; quote: string }) {
    return this.mutate((db) => {
      const c: Comment = { id: input.id ?? randomUUID(), documentId: input.documentId, threadId: input.threadId, authorId: input.authorId, body: input.body, quote: input.quote, resolved: false, createdAt: now() };
      (db.comments ??= []).push(c);
      return c;
    });
  }

  setResolved(id: string, resolved: boolean) {
    return this.mutate((db) => {
      const c = (db.comments ?? []).find((x) => x.id === id);
      if (!c) return null;
      c.resolved = resolved;
      return c;
    });
  }

  deleteComment(id: string) {
    return this.mutate((db) => {
      const before = (db.comments ?? []).length;
      db.comments = (db.comments ?? []).filter((c) => c.id !== id && c.threadId !== id);
      return db.comments.length < before;
    });
  }
}

// ---------------------------------------------------------------------------
// Postgres store
// ---------------------------------------------------------------------------
type PgPool = import("pg").Pool;

export class PgStore implements Store {
  private ready: Promise<void> | null = null;
  constructor(private pool: PgPool) {}

  private init() {
    this.ready ??= this.pool
      .query(
        `CREATE TABLE IF NOT EXISTS documents (
           id TEXT PRIMARY KEY,
           title TEXT NOT NULL,
           content TEXT NOT NULL,
           owner_id TEXT NOT NULL,
           created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
           updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
         );
         CREATE TABLE IF NOT EXISTS document_shares (
           document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
           user_id TEXT NOT NULL,
           role TEXT NOT NULL CHECK (role IN ('editor','viewer')),
           PRIMARY KEY (document_id, user_id)
         );
         ALTER TABLE documents ADD COLUMN IF NOT EXISTS link_access TEXT NOT NULL DEFAULT 'restricted';
         CREATE TABLE IF NOT EXISTS document_comments (
           id TEXT PRIMARY KEY,
           document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
           thread_id TEXT REFERENCES document_comments(id) ON DELETE CASCADE,
           author_id TEXT NOT NULL,
           body TEXT NOT NULL,
           quote TEXT NOT NULL DEFAULT '',
           resolved BOOLEAN NOT NULL DEFAULT false,
           created_at TIMESTAMPTZ NOT NULL DEFAULT now()
         );
         CREATE INDEX IF NOT EXISTS idx_comments_doc ON document_comments(document_id);
         ALTER TABLE documents ADD COLUMN IF NOT EXISTS updated_by TEXT;
         CREATE TABLE IF NOT EXISTS document_versions (
           id TEXT PRIMARY KEY,
           document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
           title TEXT NOT NULL,
           content TEXT NOT NULL,
           author_id TEXT NOT NULL,
           created_at TIMESTAMPTZ NOT NULL DEFAULT now()
         );
         CREATE INDEX IF NOT EXISTS idx_versions_doc ON document_versions(document_id, created_at DESC);
         CREATE TABLE IF NOT EXISTS document_presence (
           document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
           user_id TEXT NOT NULL,
           mode TEXT NOT NULL,
           last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
           PRIMARY KEY (document_id, user_id)
         );
         CREATE INDEX IF NOT EXISTS idx_documents_owner ON documents(owner_id);
         CREATE INDEX IF NOT EXISTS idx_shares_user ON document_shares(user_id);`
      )
      .then(() => undefined);
    return this.ready;
  }

  private async hydrate(rows: Record<string, unknown>[]): Promise<DocumentRecord[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id as string);
    const shares = await this.pool.query(
      "SELECT document_id, user_id, role FROM document_shares WHERE document_id = ANY($1)",
      [ids]
    );
    const byDoc = new Map<string, Share[]>();
    for (const s of shares.rows) {
      const list = byDoc.get(s.document_id) ?? [];
      list.push({ userId: s.user_id, role: s.role });
      byDoc.set(s.document_id, list);
    }
    return rows.map((r) => ({
      id: r.id as string,
      title: r.title as string,
      content: r.content as string,
      ownerId: r.owner_id as string,
      linkAccess: ((r.link_access as string) || "restricted") as LinkAccess,
      updatedBy: (r.updated_by as string) ?? undefined,
      shares: byDoc.get(r.id as string) ?? [],
      createdAt: new Date(r.created_at as string).toISOString(),
      updatedAt: new Date(r.updated_at as string).toISOString(),
    }));
  }

  async listForUser(userId: string) {
    await this.init();
    const res = await this.pool.query(
      `SELECT d.* FROM documents d
       WHERE d.owner_id = $1
          OR EXISTS (SELECT 1 FROM document_shares s WHERE s.document_id = d.id AND s.user_id = $1)
       ORDER BY d.updated_at DESC`,
      [userId]
    );
    return this.hydrate(res.rows);
  }

  async get(id: string) {
    await this.init();
    const res = await this.pool.query("SELECT * FROM documents WHERE id = $1", [id]);
    return (await this.hydrate(res.rows))[0] ?? null;
  }

  async create(input: { title: string; content: string; ownerId: string }) {
    await this.init();
    const res = await this.pool.query(
      "INSERT INTO documents (id, title, content, owner_id) VALUES ($1, $2, $3, $4) RETURNING *",
      [randomUUID(), input.title, input.content, input.ownerId]
    );
    return (await this.hydrate(res.rows))[0];
  }

  async update(id: string, patch: { title?: string; content?: string; linkAccess?: LinkAccess; updatedBy?: string }) {
    await this.init();
    const res = await this.pool.query(
      `UPDATE documents SET
         title = COALESCE($2, title),
         content = COALESCE($3, content),
         link_access = COALESCE($4, link_access),
         updated_by = CASE WHEN $3::text IS NULL THEN updated_by ELSE COALESCE($5, updated_by) END,
         updated_at = CASE WHEN $3::text IS NULL AND $2::text IS NULL THEN updated_at ELSE now() END
       WHERE id = $1 RETURNING *`,
      [id, patch.title ?? null, patch.content ?? null, patch.linkAccess ?? null, patch.updatedBy ?? null]
    );
    return (await this.hydrate(res.rows))[0] ?? null;
  }

  async remove(id: string) {
    await this.init();
    const res = await this.pool.query("DELETE FROM documents WHERE id = $1", [id]);
    return (res.rowCount ?? 0) > 0;
  }

  async upsertShare(id: string, userId: string, role: ShareRole) {
    await this.init();
    await this.pool.query(
      `INSERT INTO document_shares (document_id, user_id, role) VALUES ($1, $2, $3)
       ON CONFLICT (document_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
      [id, userId, role]
    );
    return this.get(id);
  }

  async removeShare(id: string, userId: string) {
    await this.init();
    await this.pool.query("DELETE FROM document_shares WHERE document_id = $1 AND user_id = $2", [id, userId]);
    return this.get(id);
  }
  async listVersions(documentId: string) {
    await this.init();
    const res = await this.pool.query("SELECT id, document_id, title, author_id, created_at FROM document_versions WHERE document_id = $1 ORDER BY created_at DESC", [documentId]);
    return res.rows.map((r) => ({ id: r.id, documentId: r.document_id, title: r.title, authorId: r.author_id, createdAt: new Date(r.created_at).toISOString() }));
  }

  async getVersion(id: string) {
    await this.init();
    const res = await this.pool.query("SELECT * FROM document_versions WHERE id = $1", [id]);
    const r = res.rows[0];
    return r ? { id: r.id, documentId: r.document_id, title: r.title, content: r.content, authorId: r.author_id, createdAt: new Date(r.created_at).toISOString() } : null;
  }

  async addVersion(input: { documentId: string; title: string; content: string; authorId: string; createdAt?: string }) {
    await this.init();
    const res = await this.pool.query(
      "INSERT INTO document_versions (id, document_id, title, content, author_id, created_at) VALUES ($1, $2, $3, $4, $5, COALESCE($6::timestamptz, now())) RETURNING *",
      [randomUUID(), input.documentId, input.title, input.content, input.authorId, input.createdAt ?? null]
    );
    const r = res.rows[0];
    return { id: r.id, documentId: r.document_id, title: r.title, content: r.content, authorId: r.author_id, createdAt: new Date(r.created_at).toISOString() };
  }

  async pruneVersions(documentId: string, keep: number) {
    await this.init();
    await this.pool.query(
      `DELETE FROM document_versions WHERE document_id = $1 AND id NOT IN
         (SELECT id FROM document_versions WHERE document_id = $1 ORDER BY created_at DESC LIMIT $2)`,
      [documentId, keep]
    );
  }

  async touchPresence(documentId: string, userId: string, mode: Presence["mode"]) {
    await this.init();
    await this.pool.query(
      `INSERT INTO document_presence (document_id, user_id, mode, last_seen) VALUES ($1, $2, $3, now())
       ON CONFLICT (document_id, user_id) DO UPDATE SET mode = EXCLUDED.mode, last_seen = now()`,
      [documentId, userId, mode]
    );
  }

  async listPresence(documentId: string, withinMs: number) {
    await this.init();
    const res = await this.pool.query(
      "SELECT user_id, mode, last_seen FROM document_presence WHERE document_id = $1 AND last_seen >= now() - ($2::text || ' milliseconds')::interval",
      [documentId, String(withinMs)]
    );
    return res.rows.map((r) => ({ userId: r.user_id, mode: r.mode, lastSeen: new Date(r.last_seen).toISOString() }));
  }

  private toComment(r: Record<string, unknown>): Comment {
    return {
      id: r.id as string, documentId: r.document_id as string, threadId: (r.thread_id as string) ?? null,
      authorId: r.author_id as string, body: r.body as string, quote: r.quote as string,
      resolved: Boolean(r.resolved), createdAt: new Date(r.created_at as string).toISOString(),
    };
  }

  async listComments(documentId: string) {
    await this.init();
    const res = await this.pool.query("SELECT * FROM document_comments WHERE document_id = $1 ORDER BY created_at", [documentId]);
    return res.rows.map((r) => this.toComment(r));
  }

  async getComment(id: string) {
    await this.init();
    const res = await this.pool.query("SELECT * FROM document_comments WHERE id = $1", [id]);
    return res.rows[0] ? this.toComment(res.rows[0]) : null;
  }

  async addComment(input: { id?: string; documentId: string; threadId: string | null; authorId: string; body: string; quote: string }) {
    await this.init();
    const res = await this.pool.query(
      "INSERT INTO document_comments (id, document_id, thread_id, author_id, body, quote) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
      [input.id ?? randomUUID(), input.documentId, input.threadId, input.authorId, input.body, input.quote]
    );
    return this.toComment(res.rows[0]);
  }

  async setResolved(id: string, resolved: boolean) {
    await this.init();
    const res = await this.pool.query("UPDATE document_comments SET resolved = $2 WHERE id = $1 RETURNING *", [id, resolved]);
    return res.rows[0] ? this.toComment(res.rows[0]) : null;
  }

  async deleteComment(id: string) {
    await this.init();
    const res = await this.pool.query("DELETE FROM document_comments WHERE id = $1", [id]);
    return (res.rowCount ?? 0) > 0;
  }
}

// ---------------------------------------------------------------------------
let singleton: Store | null = null;

export async function getStore(): Promise<Store> {
  if (singleton) return singleton;
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (url) {
    const { Pool } = await import("pg");
    const needsSsl = !/localhost|127\.0\.0\.1/.test(url);
    singleton = new PgStore(new Pool({ connectionString: url, max: 3, ssl: needsSsl ? { rejectUnauthorized: false } : undefined }));
  } else {
    if (process.env.VERCEL) {
      console.warn("DATABASE_URL is not set: falling back to /tmp JSON store, which does NOT persist on Vercel.");
    }
    const file = process.env.DATA_FILE || (process.env.VERCEL ? "/tmp/ajaia-db.json" : path.join(process.cwd(), ".data", "db.json"));
    singleton = new JsonFileStore(file);
  }
  return singleton;
}
