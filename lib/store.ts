import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { DocumentRecord, Share, ShareRole } from "./types";

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
  update(id: string, patch: { title?: string; content?: string }): Promise<DocumentRecord | null>;
  remove(id: string): Promise<boolean>;
  upsertShare(id: string, userId: string, role: ShareRole): Promise<DocumentRecord | null>;
  removeShare(id: string, userId: string): Promise<DocumentRecord | null>;
}

function now() {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// JSON file store
// ---------------------------------------------------------------------------
interface JsonDb {
  documents: DocumentRecord[];
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

  update(id: string, patch: { title?: string; content?: string }) {
    return this.mutate((db) => {
      const doc = db.documents.find((d) => d.id === id);
      if (!doc) return null;
      if (patch.title !== undefined) doc.title = patch.title;
      if (patch.content !== undefined) doc.content = patch.content;
      doc.updatedAt = now();
      return doc;
    });
  }

  remove(id: string) {
    return this.mutate((db) => {
      const before = db.documents.length;
      db.documents = db.documents.filter((d) => d.id !== id);
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

  async update(id: string, patch: { title?: string; content?: string }) {
    await this.init();
    const res = await this.pool.query(
      `UPDATE documents SET
         title = COALESCE($2, title),
         content = COALESCE($3, content),
         updated_at = now()
       WHERE id = $1 RETURNING *`,
      [id, patch.title ?? null, patch.content ?? null]
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
