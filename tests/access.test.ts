import { describe, expect, it } from "vitest";
import { canEdit, canManage, canView, roleFor } from "@/lib/access";
import type { DocumentRecord } from "@/lib/types";

const doc: DocumentRecord = {
  id: "d1",
  title: "Plan",
  content: "<p>hi</p>",
  ownerId: "u_alice",
  shares: [
    { userId: "u_bob", role: "editor" },
    { userId: "u_carol", role: "viewer" },
  ],
  createdAt: "",
  updatedAt: "",
};

describe("access rules", () => {
  it("gives the owner full control", () => {
    expect(roleFor(doc, "u_alice")).toBe("owner");
    expect(canEdit(doc, "u_alice")).toBe(true);
    expect(canManage(doc, "u_alice")).toBe(true);
  });

  it("lets editors edit but not manage sharing", () => {
    expect(canEdit(doc, "u_bob")).toBe(true);
    expect(canManage(doc, "u_bob")).toBe(false);
  });

  it("keeps viewers read-only", () => {
    expect(canView(doc, "u_carol")).toBe(true);
    expect(canEdit(doc, "u_carol")).toBe(false);
  });

  it("denies everyone else", () => {
    expect(roleFor(doc, "u_mallory")).toBeNull();
    expect(canView(doc, "u_mallory")).toBe(false);
  });
});
