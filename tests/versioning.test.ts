import { describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { JsonFileStore } from "@/lib/store";
import { isStaleWrite, snapshotBeforeChange } from "@/lib/versioning";

const fresh = () => new JsonFileStore(path.join(mkdtempSync(path.join(tmpdir(), "ajaia-v-")), "db.json"));

describe("version history", () => {
  it("checkpoints the previous content when a different person edits", async () => {
    const store = fresh();
    let doc = (await store.create({ title: "T", content: "<p>v1</p>", ownerId: "u_alice" }))!;
    await snapshotBeforeChange(store, doc, "u_alice");
    doc = (await store.update(doc.id, { content: "<p>v2</p>", updatedBy: "u_alice" }))!;
    await snapshotBeforeChange(store, doc, "u_alice"); // same person, same session → no new checkpoint
    doc = (await store.update(doc.id, { content: "<p>v3</p>", updatedBy: "u_alice" }))!;
    await snapshotBeforeChange(store, doc, "u_carol"); // someone else → checkpoint Alice's v3
    const versions = await store.listVersions(doc.id);
    const contents = await Promise.all(versions.map(async (v) => (await store.getVersion(v.id))!.content));
    expect(contents).toEqual(["<p>v3</p>", "<p>v1</p>"]);
    expect(versions[0].authorId).toBe("u_alice");
  });

  it("detects a stale write only when someone else saved after the client's base", () => {
    const doc = { id: "d", title: "", content: "", ownerId: "u_alice", shares: [], createdAt: "", updatedAt: "2026-01-01T10:00:05.000Z", updatedBy: "u_carol" };
    expect(isStaleWrite(doc, "u_alice", "2026-01-01T10:00:00.000Z")).toBe(true);
    expect(isStaleWrite(doc, "u_alice", "2026-01-01T10:00:05.000Z")).toBe(false);
    expect(isStaleWrite(doc, "u_carol", "2026-01-01T10:00:00.000Z")).toBe(false);
    expect(isStaleWrite(doc, "u_alice", undefined)).toBe(false);
  });
});
