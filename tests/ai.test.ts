import { afterEach, describe, expect, it, vi } from "vitest";
import { aiMarkdownToHtml, buildMessages, cleanMarkdown, generate, titleFromMarkdown } from "@/lib/ai";

afterEach(() => { vi.unstubAllEnvs(); });

describe("AI helpers", () => {
  it("strips code fences and chatty preambles", () => {
    expect(cleanMarkdown("```markdown\n# Hi\n\nText\n```")).toBe("# Hi\n\nText");
    expect(cleanMarkdown("Sure! Here is your draft:\n\n# Plan")).toBe("# Plan");
  });

  it("sanitizes AI output through the same pipeline as imports", async () => {
    const html = await aiMarkdownToHtml("## Title\n\n**bold** <script>alert(1)</script>\n\n- a");
    expect(html).toContain("<h2>Title</h2>");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).not.toContain("<script");
  });

  it("puts the selection and instruction in the prompt", () => {
    const [, user] = buildMessages("shorten", { text: "Long text" });
    expect(user.content).toMatch(/shorter/);
    expect(user.content).toContain("Long text");
  });

  it("derives a title from the first heading", () => {
    expect(titleFromMarkdown("# **Launch** Plan\n\nBody", "x")).toBe("Launch Plan");
    expect(titleFromMarkdown("No heading", "Fallback")).toBe("Fallback");
  });

  it("falls back to the next model when the first one fails", async () => {
    vi.stubEnv("AI_API_KEY", "test-key");
    vi.stubEnv("AI_MODEL", "x-ai/grok-4.1-fast:free");
    const calls: string[] = [];
    const fake = (async (_url: string, init: RequestInit) => {
      const model = JSON.parse(String(init.body)).model;
      calls.push(model);
      if (model.startsWith("x-ai")) return new Response(JSON.stringify({ error: { message: "No endpoints" } }), { status: 404 });
      return new Response(JSON.stringify({ choices: [{ message: { content: "# Ok" } }] }), { status: 200 });
    }) as unknown as typeof fetch;
    const out = await generate(buildMessages("draft", { prompt: "x" }), { fetchImpl: fake });
    expect(calls).toEqual(["x-ai/grok-4.1-fast:free", "openrouter/free"]);
    expect(out).toEqual({ markdown: "# Ok", model: "openrouter/free", skipped: ["x-ai/grok-4.1-fast:free: 404 No endpoints"] });
  });

  it("reports a clear error when AI is not configured", async () => {
    vi.stubEnv("AI_API_KEY", "");
    vi.stubEnv("OPENROUTER_API_KEY", "");
    await expect(generate(buildMessages("draft", { prompt: "x" }))).rejects.toThrow(/not configured/);
  });
});
