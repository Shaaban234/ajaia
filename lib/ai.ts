import { markdownToHtml, sanitizeDocumentHtml } from "./content";

/**
 * "Write with AI". Talks to any OpenAI-compatible chat endpoint; defaults to
 * OpenRouter's free Grok model. The model only ever produces Markdown, which we
 * convert and sanitize with the same pipeline as file import, so AI output can
 * never inject anything the editor couldn't produce itself.
 */
export const AI_ACTIONS = ["draft", "continue", "improve", "shorten", "expand", "fix", "professional"] as const;
export type AiAction = (typeof AI_ACTIONS)[number];

export const MAX_PROMPT = 2_000;
export const MAX_TEXT = 12_000;

export function aiConfig() {
  const apiKey = process.env.AI_API_KEY || process.env.OPENROUTER_API_KEY || "";
  const baseUrl = (process.env.AI_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/$/, "");
  const primary = process.env.AI_MODEL || "x-ai/grok-4.1-fast:free";
  // Free model IDs come and go; fall back to OpenRouter's free-model router.
  const models = [...new Set([primary, ...(baseUrl.includes("openrouter.ai") ? ["openrouter/free"] : [])])];
  return { enabled: Boolean(apiKey), apiKey, baseUrl, models };
}

const SYSTEM = `You are a writing assistant inside a document editor.
Rules:
- Reply with the document content only, formatted as Markdown. No preamble, no "Here is", no closing remarks.
- Use only: headings (#, ##, ###), paragraphs, **bold**, *italic*, bullet lists, numbered lists, > quotes.
- Never wrap the answer in a code block.
- Keep the author's language and meaning unless asked to change them.
- When given text to rewrite, return exactly ONE rewritten version of that text. Never offer options, alternatives, versions, explanations or commentary, and never add headings the original did not have.`;

const INSTRUCTIONS: Record<AiAction, string> = {
  draft: "Write new content for the document based on the request.",
  continue: "Continue the document naturally from where it ends. Return only the new continuation (1-3 paragraphs), not the existing text.",
  improve: "Rewrite the text to be clearer and better written, keeping the meaning and roughly the same length. Return only the rewritten text.",
  shorten: "Make the text noticeably shorter while keeping the key points.",
  expand: "Expand the text with more detail and useful specifics.",
  fix: "Fix spelling, grammar and punctuation only. Change nothing else.",
  professional: "Rewrite the text in a confident, professional tone. Return only the rewritten text.",
};

export function buildMessages(action: AiAction, input: { prompt?: string; text?: string; context?: string }) {
  const parts = [INSTRUCTIONS[action]];
  if (input.prompt) parts.push(`Request: ${input.prompt}`);
  if (input.context) parts.push(`Document so far (for context only):\n"""\n${input.context}\n"""`);
  if (input.text) parts.push(`Text to work on:\n"""\n${input.text}\n"""`);
  return [
    { role: "system" as const, content: SYSTEM },
    { role: "user" as const, content: parts.join("\n\n") },
  ];
}

/** Models occasionally ignore instructions; strip code fences and chatty preambles. */
export function cleanMarkdown(raw: string): string {
  let s = raw.trim();
  const fence = s.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/i);
  if (fence) s = fence[1].trim();
  // Drop a conversational first line like "Sure! Here is your draft:".
  const [first, ...rest] = s.split("\n");
  if (rest.length && /^(sure|certainly|of course|absolutely|here(?:'s| is| are))\b/i.test(first.trim())) s = rest.join("\n");
  return s.trim();
}

export async function aiMarkdownToHtml(md: string): Promise<string> {
  return sanitizeDocumentHtml(await markdownToHtml(cleanMarkdown(md)));
}

export class AiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function generate(
  messages: ReturnType<typeof buildMessages>,
  opts: { fetchImpl?: typeof fetch; signal?: AbortSignal } = {}
): Promise<{ markdown: string; model: string; skipped: string[] }> {
  const cfg = aiConfig();
  if (!cfg.enabled) throw new AiError(503, "AI is not configured on this server (set AI_API_KEY).");
  const doFetch = opts.fetchImpl ?? fetch;
  let lastError = "The AI service is unavailable right now.";
  const skipped: string[] = [];

  for (const model of cfg.models) {
    try {
      const res = await doFetch(`${cfg.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cfg.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.APP_URL || "https://ajaia-docs.vercel.app",
          "X-Title": "Ajaia Docs",
        },
        body: JSON.stringify({ model, messages, temperature: 0.4, max_tokens: 1500 }),
        signal: opts.signal ?? AbortSignal.timeout(45_000),
      });
      const body = await res.json().catch(() => null);
      const content: unknown = body?.choices?.[0]?.message?.content;
      if (res.ok && typeof content === "string" && content.trim()) return { markdown: content, model, skipped };
      lastError = res.status === 429 ? "The free AI model is rate-limited. Try again in a minute." : body?.error?.message || lastError;
      skipped.push(`${model}: ${res.status} ${String(body?.error?.message ?? "empty response").slice(0, 160)}`);
    } catch (err) {
      lastError = (err as Error).name === "TimeoutError" ? "The AI took too long to respond." : lastError;
      skipped.push(`${model}: ${(err as Error).name}`);
    }
  }
  throw new AiError(502, lastError);
}

/** Tiny per-user rate limit (per server instance) so a free key isn't burned by one user. */
const hits = new Map<string, number[]>();
export function rateLimited(userId: string, limit = 12, windowMs = 60_000): boolean {
  const now = Date.now();
  const recent = (hits.get(userId) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(userId, recent);
  return recent.length > limit;
}

export function titleFromMarkdown(md: string, fallback: string): string {
  const h = cleanMarkdown(md).match(/^#{1,3}\s+(.+)$/m);
  return (h?.[1] ?? fallback).replace(/[*_`]/g, "").trim().slice(0, 120) || "AI draft";
}
