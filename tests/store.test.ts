import { describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { JsonFileStore } from "@/lib/store";

function freshStore() {
  return new JsonFileStore(path.join(mkdtempSync(path.join(tmpdir(), "ajaia-")), "db.json"));
}

describe("JsonFileStore sharing flow", () => {
  it("persists documents and shows shared docs to the grantee only", async () => {
    const store = freshStore();
    const doc = await store.create({ title: "Spec", content: "<p><strong>hi</strong></p>", ownerId: "u_alice" });

    expect(await store.listForUser("u_bob")).toHaveLength(0);
    await store.upsertShare(doc.id, "u_bob", "viewer");
    const bobs = await store.listForUser("u_bob");
    expect(bobs.map((d) => d.id)).toEqual([doc.id]);
    expect(await store.listForUser("u_carol")).toHaveLength(0);

    // Upgrading a role updates rather than duplicating the share.
    const upgraded = await store.upsertShare(doc.id, "u_bob", "editor");
    expect(upgraded?.shares).toEqual([{ userId: "u_bob", role: "editor" }]);

    await store.removeShare(doc.id, "u_bob");
    expect(await store.listForUser("u_bob")).toHaveLength(0);
  });

  it("preserves formatting across a reload from disk", async () => {
    const store = freshStore();
    const doc = await store.create({ title: "A", content: "<p></p>", ownerId: "u_alice" });
    await store.update(doc.id, { content: "<h1>T</h1><ul><li><p><em>x</em></p></li></ul>" });
    // A brand-new instance reading the same file simulates a server restart.
    const reloaded = new JsonFileStore((store as unknown as { file: string }).file);
    expect((await reloaded.get(doc.id))?.content).toBe("<h1>T</h1><ul><li><p><em>x</em></p></li></ul>");
  });

  it("does not lose writes under concurrent updates", async () => {
    const store = freshStore();
    const docs = await Promise.all(Array.from({ length: 10 }, (_, i) => store.create({ title: `D${i}`, content: "<p></p>", ownerId: "u_alice" })));
    expect(await store.listForUser("u_alice")).toHaveLength(docs.length);
  });

  it("stores comment threads and deletes replies with their thread", async () => {
    const store = freshStore();
    const doc = await store.create({ title: "C", content: "<p>x</p>", ownerId: "u_alice" });
    const root = await store.addComment({ documentId: doc.id, threadId: null, authorId: "u_alice", body: "Clarify?", quote: "x" });
    await store.addComment({ documentId: doc.id, threadId: root.id, authorId: "u_bob", body: "Done", quote: "" });
    expect(await store.listComments(doc.id)).toHaveLength(2);
    expect((await store.setResolved(root.id, true))?.resolved).toBe(true);
    await store.deleteComment(root.id);
    expect(await store.listComments(doc.id)).toHaveLength(0);
  });
});
