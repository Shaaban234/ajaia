import sanitizeHtml from "sanitize-html";
import { marked } from "marked";
import mammoth from "mammoth";

/** The HTML subset the editor can represent. Everything else is stripped. */
const ALLOWED: sanitizeHtml.IOptions = {
  allowedTags: ["p", "br", "strong", "b", "em", "i", "u", "s", "h1", "h2", "h3", "ul", "ol", "li", "blockquote", "code", "pre", "a", "hr"],
  allowedAttributes: { a: ["href", "target", "rel"] },
  allowedSchemes: ["http", "https", "mailto"],
};

export function sanitizeDocumentHtml(html: string): string {
  return sanitizeHtml(html, ALLOWED);
}

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB
export const SUPPORTED_EXTENSIONS = [".txt", ".md", ".docx"] as const;
export type SupportedExtension = (typeof SUPPORTED_EXTENSIONS)[number];

export function extensionOf(filename: string): string {
  const i = filename.lastIndexOf(".");
  return i === -1 ? "" : filename.slice(i).toLowerCase();
}

export function isSupported(filename: string): filename is `${string}${SupportedExtension}` {
  return (SUPPORTED_EXTENSIONS as readonly string[]).includes(extensionOf(filename));
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Plain text: blank lines separate paragraphs, single newlines become <br>. */
export function textToHtml(text: string): string {
  const paragraphs = text.replace(/\r\n?/g, "\n").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  if (paragraphs.length === 0) return "<p></p>";
  return paragraphs.map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`).join("");
}

export async function markdownToHtml(md: string): Promise<string> {
  const html = await marked.parse(md, { gfm: true });
  // Editor only supports h1-h3; demote deeper headings instead of losing them.
  return html.replace(/<(\/?)h[4-6]>/g, "<$1h3>");
}

export async function fileToHtml(filename: string, data: Buffer): Promise<string> {
  const ext = extensionOf(filename);
  let html: string;
  if (ext === ".txt") html = textToHtml(data.toString("utf8"));
  else if (ext === ".md") html = await markdownToHtml(data.toString("utf8"));
  else if (ext === ".docx") html = (await mammoth.convertToHtml({ buffer: data })).value;
  else throw new Error(`Unsupported file type "${ext || "none"}". Supported: ${SUPPORTED_EXTENSIONS.join(", ")}`);
  const clean = sanitizeDocumentHtml(html);
  return clean.trim() ? clean : "<p></p>";
}

/** Document title derived from an uploaded filename. */
export function titleFromFilename(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  return (base || "Imported document").slice(0, 120);
}

export const MAX_TITLE = 120;
export const MAX_CONTENT_BYTES = 1_000_000;

export function validateTitle(raw: unknown): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof raw !== "string") return { ok: false, error: "Title must be a string." };
  const value = raw.trim();
  if (!value) return { ok: false, error: "Title cannot be empty." };
  if (value.length > MAX_TITLE) return { ok: false, error: `Title must be ${MAX_TITLE} characters or fewer.` };
  return { ok: true, value };
}

/** Plain-text preview of a document for dashboard cards. */
export function excerptOf(html: string, max = 220): string {
  const text = html.replace(/<\/(p|h[1-6]|li)>/g, " ").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
  return text.length > max ? text.slice(0, max).trimEnd() + "…" : text;
}
