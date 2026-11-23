# Ajaia Docs

A lightweight collaborative document editor: create and format documents, import files, and share them with other users as **viewer** or **editor**.

**Live demo:** _<add Vercel URL>_
**Demo accounts** (password for all: `demo1234`). The login page also has one-click buttons:

| User | Email |
|---|---|
| Alice Khan | alice@ajaia.test |
| Bob Martin | bob@ajaia.test |
| Carol Diaz | carol@ajaia.test |

## What works

- **Documents:** create, rename (owner only), delete (owner only), and edit in the browser. Changes autosave 800 ms after you stop typing, and the status reads *Unsaved / Saving… / All changes saved / Save failed (Retry)*. You get a warning if you leave with unsaved changes.
- **Rich text:** bold, italic, underline, H1–H3, bulleted and numbered lists, undo/redo, plus keyboard shortcuts.
- **File import:** upload **.txt, .md or .docx** (max 5 MB) to create a new editable document. Headings, bold/italic and lists are preserved. Other types are rejected with a clear message.
- **Sharing:** the owner shares by email as *Can edit* or *Can view*, can change a role, and can remove access. The dashboard splits **My documents** from **Shared with me**, and the editor shows a role badge. Viewers get a read-only editor; the API enforces this too, not just the UI.
- **Persistence:** Postgres in production, a JSON file locally. Content is stored as sanitized HTML, so formatting survives a reload.
- **Write with AI** (AI-native feature):
  - **Create with AI** on the dashboard drafts a whole new document from a prompt.
  - In the editor, press **Ctrl+J**, or use the ✦ button or the AI menu, to draft at the cursor or continue writing. With text selected, you can improve it, fix grammar, make it shorter or longer, or rewrite it in a professional tone.
  - The AI always shows a **preview** first. You choose Insert, Replace, Retry or Discard, so nothing changes in the document without your click.
  - It uses any OpenAI-compatible API, by default **OpenRouter's free Grok model** (`x-ai/grok-4.1-fast:free`). If that model is unavailable, it falls back to `openrouter/free`.
  - AI output goes through the same Markdown → HTML sanitizer as file import.
- **Docs-style editor:**
  - A letter-size page, a working menu bar (File, Edit, Insert, Format, AI, Help) and a text-style dropdown.
  - An Editing/Viewing indicator, a save status, and a keyboard-shortcut sheet.
- **Stretch:** export any document to Markdown.

## Run locally

Requires Node 20+.

```bash
npm install
npm run dev          # http://localhost:3000, data stored in .data/db.json
npm test             # 19 tests: access rules, import, storage, AI helpers
npm run build && npm start   # production build
```

No database is needed locally. To run against Postgres instead, set `DATABASE_URL`; tables are created automatically on first request.

| Env var | Purpose |
|---|---|
| `DATABASE_URL` (or `POSTGRES_URL`) | Postgres connection string. When unset, the JSON file store is used. |
| `SESSION_SECRET` | HMAC key for the session cookie. Set a long random value in production. |
| `DATA_FILE` | Optional path for the JSON store. |
| `AI_API_KEY` (or `OPENROUTER_API_KEY`) | Enables the AI features. Get a free key at openrouter.ai/keys. Without it, the app works and AI buttons explain that AI is not configured. |
| `AI_MODEL` | Optional. Defaults to `x-ai/grok-4.1-fast:free`. |
| `AI_BASE_URL` | Optional. Any OpenAI-compatible endpoint; defaults to `https://openrouter.ai/api/v1`. |

## Deploy (Vercel + Neon, both free)

1. Import the repo into Vercel (framework: Next.js, default settings).
2. Project → **Storage** → **Create Database** → **Neon (Postgres)** → connect it to the project. This injects `DATABASE_URL`.
3. Add `SESSION_SECRET` and `AI_API_KEY` under Environment Variables, then redeploy.

## Try the sharing flow

1. Sign in as **Alice** and create a document (or import `samples/quarterly-review.docx`).
2. Click **Share**, then add `bob@ajaia.test` as *Can view* and `carol@ajaia.test` as *Can edit*.
3. Sign out and sign in as **Bob**. The document appears under *Shared with me* and opens read-only.
4. Sign in as **Carol**. She can edit, and her changes are visible to Alice after a refresh. She cannot rename, delete or reshare.

## Project layout

```
app/                 Next.js App Router pages + API route handlers
  api/session        mock login / logout
  api/documents      list, create, read, update, delete, share, export
  api/import         file upload → new document
components/          Dashboard, DocumentEditor (TipTap), Toolbar, ShareDialog
lib/access.ts        pure authorization rules (owner / editor / viewer)
lib/store.ts         Store interface + JsonFileStore + PgStore
lib/content.ts       sanitizing, .txt/.md/.docx → HTML, validation
tests/               Vitest suites
samples/             files for trying the import
docs/screenshots/    UI screenshots
```

See [ARCHITECTURE.md](ARCHITECTURE.md) and [AI_WORKFLOW.md](AI_WORKFLOW.md).
