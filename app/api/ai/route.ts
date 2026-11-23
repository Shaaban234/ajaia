import { NextResponse } from "next/server";
import { errorResponse, HttpError, readJson, requireUser } from "@/lib/api";
import { AI_ACTIONS, AiError, aiConfig, aiMarkdownToHtml, cleanMarkdown, buildMessages, generate, MAX_PROMPT, MAX_TEXT, rateLimited, type AiAction } from "@/lib/ai";

export const maxDuration = 60;

/** Lets the UI show/hide AI features. */
export async function GET() {
  try {
    await requireUser();
    return NextResponse.json({ enabled: aiConfig().enabled });
  } catch (err) {
    return errorResponse(err);
  }
}

/** { action, prompt?, text?, context? } → { html, markdown, model }. Nothing is saved; the user reviews first. */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await readJson(req);
    const action = body.action as AiAction;
    if (!AI_ACTIONS.includes(action)) throw new HttpError(400, "Unknown AI action.");
    const str = (v: unknown, max: number, name: string) => {
      if (v === undefined || v === null || v === "") return undefined;
      if (typeof v !== "string") throw new HttpError(400, `${name} must be text.`);
      if (v.length > max) throw new HttpError(413, `${name} is too long (max ${max.toLocaleString()} characters).`);
      return v.trim();
    };
    const prompt = str(body.prompt, MAX_PROMPT, "Prompt");
    const text = str(body.text, MAX_TEXT, "Selected text");
    const context = str(body.context, MAX_TEXT, "Context");
    if (action === "draft" && !prompt) throw new HttpError(400, "Describe what you want written.");
    if (!["draft", "continue"].includes(action) && !text) throw new HttpError(400, "Select some text first.");
    if (action === "continue" && !context) throw new HttpError(400, "There is nothing to continue yet.");
    if (rateLimited(user.id)) throw new HttpError(429, "Too many AI requests. Wait a moment and try again.");

    const { markdown, model, skipped } = await generate(buildMessages(action, { prompt, text, context: context?.slice(-4000) }));
    return NextResponse.json({ html: await aiMarkdownToHtml(markdown), markdown: cleanMarkdown(markdown), model, skipped });
  } catch (err) {
    if (err instanceof AiError) return NextResponse.json({ error: err.message }, { status: err.status });
    return errorResponse(err);
  }
}
