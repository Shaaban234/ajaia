# AI workflow note

## Tools used
- **Claude (Anthropic)** as an AI coding assistant. I defined the scope and priorities from the brief, then used it to generate most of the implementation, the tests and first drafts of the docs, which I reviewed and verified.
- **OpenRouter** (free models) for the in-product "Write with AI" feature, so reviewers never pay for anything.

## Where AI materially sped things up
- **Scaffolding and boilerplate:** Next.js routes, the storage interface with two implementations, and the TipTap toolbar. That is hours of typing compressed into minutes.
- **Library glue:** mammoth (.docx), marked (.md), sanitize-html and turndown wiring, including demoting h4–h6 to h3 so imported headings aren't lost.
- **Test and verification harness:** unit tests for access rules, import and storage, plus a throwaway Playwright script that drove the real UI (create → format → reload → share → sign in as the other user → confirm read-only) and took screenshots.

## AI output that was changed or rejected
- **Autosave dirty-state bug:** the first editor version showed "Unsaved changes" right after opening a document, because TipTap emits a no-op update when content and editability are set. It would also have sent a write attempt for view-only users. This was caught in the browser test and fixed by comparing against the last-saved normalized HTML and ignoring updates when the doc isn't editable.
- **Tooling version mismatch:** the latest TypeScript (7.x) broke Next 15's path aliases, so it was pinned to TS 5.
- **Rejected approaches:**
  - Storing documents in Vercel Blob, because CDN caching would make "refresh shows my latest save" unreliable. Postgres was used instead.
  - Building real-time co-editing inside the timebox. It was scoped out deliberately (see ARCHITECTURE.md).
- **Changes I pushed for after reviewing it myself:**
  - The first UI worked but looked plain, so I had it reworked into a Google Docs-style layout: menu bar, full toolbar, ruler, Share dialog, template gallery and outline.
  - I scoped the stretch work to presence, comments, version history and export, and explicitly said no to multi-tab documents and suggestion mode in the time available.
  - I had the always-on word-count footer removed and replaced with a Google Docs-style Tools → Word count dialog.

## AI inside the product
- I added "Write with AI" because this is an AI-native role. I designed it so AI suggestions are previews the user accepts or rejects, never silent edits.
- **Verification:**
  - Unit tests cover output cleanup, sanitizing, title extraction, the model fallback (with a mocked fetch) and the "not configured" path.
  - The full UI flow was tested in a browser against a local mock of the OpenAI-compatible API, because the sandbox couldn't reach OpenRouter.
  - Tested on the deployed URL with a real OpenRouter key. That run showed:
    - The original default, Grok 4.1 Fast (free), had been deprecated; the fallback had silently caught it. The default is now `openrouter/free`, and the response reports which model answered and why one was skipped.
    - "Improve writing" sometimes returned a menu of options instead of one rewrite, so the prompt was tightened.
    - A reasoning model could return a cut-off draft, so cut-off answers are now retried.

## How correctness and quality were verified
- `npm test`: 26 tests cover owner/editor/viewer/no-access rules, sanitizing (script, `onclick` and `javascript:` stripped), .md/.txt conversion, unsupported types, title validation, share upsert/revoke, persistence across a fresh store instance, and concurrent writes.
- **API checked with curl as three different users:** an unshared user gets 404, a viewer's edit gets 403, a non-owner rename gets 403, an unauthenticated request gets 401, and an unsupported upload gets 415.
- **Browser run in Chromium:** formatting survives a reload, sharing works across accounts, viewers get a read-only editor with no toolbar, and there are no unexpected console errors. Also checked the mobile layout.
- **Live deployment:**
  - A scripted 27-step run against https://ajaia-eta.vercel.app passed: login and logout, create, rename, save and sanitize, share, viewer 403, no-access 404, link access, comments, presence, versions, import/export and templates.
  - I walked through the full flow manually in two browsers (Alice and Bob) while recording the walkthrough video.
