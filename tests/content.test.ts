import { describe, expect, it } from "vitest";
import { fileToHtml, isSupported, sanitizeDocumentHtml, textToHtml, titleFromFilename, validateTitle } from "@/lib/content";

describe("file import", () => {
  it("turns plain text paragraphs into HTML and escapes markup", () => {
    expect(textToHtml("Hello\nworld\n\nSecond <b>para</b>")).toBe("<p>Hello<br>world</p><p>Second &lt;b&gt;para&lt;/b&gt;</p>");
  });

  it("converts markdown formatting the editor supports", async () => {
    const html = await fileToHtml("notes.md", Buffer.from("# Title\n\n**bold** and _it_\n\n- a\n- b\n\n#### deep"));
    expect(html).toContain("<h1>Title</h1>");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<em>it</em>");
    expect(html).toMatch(/<ul>\s*<li>a<\/li>/);
    expect(html).toContain("<h3>deep</h3>"); // h4 demoted, not dropped
  });

  it("strips scripts and event handlers from imported or saved HTML", () => {
    const dirty = '<p onclick="x()">ok</p><script>alert(1)</script><a href="javascript:alert(1)">l</a>';
    const clean = sanitizeDocumentHtml(dirty);
    expect(clean).not.toMatch(/script|onclick|javascript:/);
    expect(clean).toContain("<p>ok</p>");
  });

  it("rejects unsupported file types", async () => {
    expect(isSupported("report.pdf")).toBe(false);
    expect(isSupported("Report.DOCX")).toBe(true);
    await expect(fileToHtml("x.pdf", Buffer.from(""))).rejects.toThrow(/Unsupported/);
  });

  it("derives a title from the filename", () => {
    expect(titleFromFilename("q4_launch-plan.docx")).toBe("q4 launch plan");
  });

  it("validates titles", () => {
    expect(validateTitle("  ").ok).toBe(false);
    expect(validateTitle("x".repeat(121)).ok).toBe(false);
    expect(validateTitle("  Roadmap ")).toEqual({ ok: true, value: "Roadmap" });
  });
});
