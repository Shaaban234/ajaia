import { describe, expect, it } from "vitest";
import { TEMPLATES } from "@/lib/templates";
import { sanitizeDocumentHtml } from "@/lib/content";

describe("templates", () => {
  it("have unique ids", () => {
    expect(new Set(TEMPLATES.map((t) => t.id)).size).toBe(TEMPLATES.length);
  });

  it("only use formatting the editor supports (sanitizer leaves them unchanged)", () => {
    for (const t of TEMPLATES) {
      const norm = (h: string) => h.replace(/\n/g, "").replace(/<hr\s*\/?>/g, "<hr />").replace(/<br\s*\/?>/g, "<br />");
      expect(norm(sanitizeDocumentHtml(t.html)), t.id).toBe(norm(t.html));
    }
  });
});
