# Architecture note

## Goal and priorities
The goal was a small slice that works end to end and is deployable, not broad Google Docs coverage. In order, I prioritized:

1. **A trustworthy editing loop:** formatting that round-trips through storage, autosave with visible status, and no lost edits on navigation.
2. **Access control that holds at the API layer:** the UI hides controls, but every route re-checks the caller's role.
3. **A useful file import:** .docx is what people actually have, so it is supported alongside .txt and .md.
4. **Low-friction review:** one-click demo users, no paid services, and zero-setup local dev.

## Stack
- **Next.js 15 (App Router)**: one deployable unit for UI and API, a natural fit for Vercel.
- **TipTap 3 (ProseMirror)**: a mature rich-text model. It outputs HTML, which keeps storage, import and export simple.
- **Postgres (Neon)** in production, **JSON file** locally, behind one `Store` interface (`lib/store.ts`). Route handlers never know which is in use, and tests run against the file store with no database.
- **mammoth** (.docx → HTML), **marked** (.md → HTML), **sanitize-html** (allow-list), **turndown** (export to Markdown).

## Data model
```
documents(id, title, content HTML, owner_id, link_access: restricted|viewer|editor, created_at, updated_at)
document_shares(document_id, user_id, role: editor|viewer)   PK (document_id, user_id)
```
Ownership is a column rather than a share row, so a document can never lose its owner. A re-share is an upsert, which changes the role instead of duplicating the row. `link_access` implements Docs-style general access. An explicit share always wins over link access, link access never grants owner rights, and link-only documents do not appear under *Shared with me* (the same as Google Docs).

## Key decisions and tradeoffs
| Decision | Why | Cost |
|---|---|---|
| Store sanitized **HTML** | Matches the editor's native output; import and export become string transforms | Less structured than ProseMirror JSON for future diffing/versioning |
| **Sanitize on every write** (import and save) with an allow-list | Shared documents are rendered for other users, so this prevents stored XSS | Unsupported formatting (tables, arbitrary CSS) is dropped |
| Inline styles (colour, font, size, alignment) kept only via a **style allow-list** with value regexes | Rich formatting without opening CSS injection (`position`, `background-image:url()` are dropped) | Arbitrary styling isn't possible |
| **Mocked auth**: 3 seeded users, HMAC-signed httpOnly cookie | The brief allows it; the time goes into sharing logic, not auth plumbing | Not production identity; no sign-up |
| **Autosave with debounce** and **last-write-wins** | Simple and predictable for one active editor | Two people editing at once can overwrite each other (see below) |
| Authorization in a **pure module** (`lib/access.ts`) | One place to reason about and unit-test | None worth noting |
| Unknown docs and no-access docs both return **404** | Doesn't reveal that a document exists | Slightly less helpful error |
| Import creates a **new document** | Clearest UX; no merge semantics to design | No "insert file into existing doc" yet |

## AI writing assistant
- **Human in the loop:** the model never writes to the document directly. `/api/ai` returns a preview, and the user chooses Insert, Replace, Retry or Discard. This keeps judgment with the author and makes bad generations cheap to reject.
- **Same safety pipeline:** the model is asked for Markdown only, which then goes through `cleanMarkdown` (strips code fences and "Sure! Here is…" preambles), then `marked`, then the sanitizer allow-list. AI output can't add anything the editor couldn't produce.
- **Provider-agnostic:** it uses an OpenAI-compatible `/chat/completions` endpoint, defaulting to OpenRouter's free Grok. Free model IDs get retired, so it falls back to `openrouter/free`, and the model name is returned to the UI for transparency.
- **Guardrails:** requires sign-in, validates input lengths, applies a per-user rate limit (12 requests/minute per instance) and a 45 s timeout, and gives clear errors for 429/5xx responses. Nothing breaks when no key is configured.

## Intentionally deprioritized
- **Real-time co-editing** (CRDT/Yjs + websockets). This is the biggest gap and the right next step, but it would have consumed most of the timebox and needs a stateful server.
- Comments, suggestions and version history.
- Real authentication and invites to people outside the user list.
- Images, tables, attachments and non-text formats in import.

## Next 2–4 hours
1. **Conflict safety:** send `updatedAt` with each save and return 409 on a stale write, then show a "reload / overwrite" prompt. This is a cheap step before full real-time.
2. **Version history:** a `document_versions` snapshot every N saves, with a restore UI.
3. **Presence indicator:** poll "who has this open" every few seconds.
4. **Playwright end-to-end test** of the share flow in CI. The flow was verified with a Playwright script during development but isn't committed as a CI test yet.
