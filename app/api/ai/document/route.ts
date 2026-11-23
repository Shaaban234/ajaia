import { NextResponse } from "next/server";
import { errorResponse, HttpError, readJson, requireUser, toView } from "@/lib/api";
import { getStore } from "@/lib/store";
import { AiError, aiMarkdownToHtml, buildMessages, generate, MAX_PROMPT, rateLimited, titleFromMarkdown } from "@/lib/ai";

export const maxDuration = 60;

/** "Create with AI": { prompt } → new document owned by the caller. */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await readJson(req);
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    if (!prompt) throw new HttpError(400, "Describe the document you want.");
    if (prompt.length > MAX_PROMPT) throw new HttpError(413, `Prompt is too long (max ${MAX_PROMPT} characters).`);
    if (rateLimited(user.id)) throw new HttpError(429, "Too many AI requests. Wait a moment and try again.");

    const { markdown } = await generate(
      buildMessages("draft", { prompt: `${prompt}\n\nStart with a single "# " title line, then the document.` })
    );
    const title = titleFromMarkdown(markdown, prompt.slice(0, 60));
    // The H1 becomes the document title, so drop it from the body to avoid repeating it.
    const bodyMd = markdown.replace(/^\s*#\s+.+\n+/, "");
    const content = await aiMarkdownToHtml(bodyMd || markdown);
    const doc = await (await getStore()).create({ title, content, ownerId: user.id });
    return NextResponse.json({ document: toView(doc, user.id) }, { status: 201 });
  } catch (err) {
    if (err instanceof AiError) return NextResponse.json({ error: err.message }, { status: err.status });
    return errorResponse(err);
  }
}
