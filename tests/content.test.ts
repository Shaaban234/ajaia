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

  it("keeps safe inline styles but drops dangerous ones", () => {
    const html = '<p style="text-align:center;position:fixed">x</p><span style="color:#d93025;background-image:url(http://evil)">y</span><img src="javascript:alert(1)"><img src="https://example.com/a.png" onerror="x()">';
    const clean = sanitizeDocumentHtml(html);
    expect(clean).toContain('style="text-align:center"');
    expect(clean).toContain('style="color:#d93025"');
    expect(clean).not.toMatch(/position|background-image|javascript:|onerror/);
    expect(clean).toContain('<img src="https://example.com/a.png" />');
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
