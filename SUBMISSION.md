# Submission — Shaaban Abdullah, AI-Native Full Stack Developer

| Item | Location |
|---|---|
| Live app | https://ajaia-eta.vercel.app (demo users: alice / bob / carol `@ajaia.test`, password `demo1234`) |
| Source code | this folder (`app/`, `components/`, `lib/`, `tests/`) |
| Setup & run instructions | `README.md` |
| Architecture note | `ARCHITECTURE.md` |
| AI workflow note | `AI_WORKFLOW.md` |
| Walkthrough video link | `VIDEO_URL.txt` |
| Screenshots | `docs/screenshots/` |
| Sample files for import | `samples/` (.docx, .md, .txt) |

**Test accounts:** alice@ajaia.test, bob@ajaia.test, carol@ajaia.test. The password is `demo1234` for all three, or use the one-click buttons on the login page.

## Status
**Working end to end:**
- Create, rename, edit and delete documents with autosave.
- Rich text: B/I/U, H1–H3, both list types.
- .txt/.md/.docx import into a new document.
- Owner shares as viewer or editor, can change roles and revoke access.
- Separate "My documents" and "Shared with me" sections.
- API-enforced permissions.
- Postgres persistence.
- Markdown export (stretch).
- **Live presence and conflict protection:** see who's viewing or editing now, idle editors receive changes automatically, and concurrent saves get a 409 with a Use theirs / Keep mine choice.
- **Version history:** preview and restore, with undoable restores.
- **Comments:** anchored threads with replies, resolve and delete, plus role-based permissions.
- **Full Docs-style toolbar:** fonts, sizes, colours, highlight, links, images, alignment, line spacing, checklists, indent, paint format, zoom, print, spellcheck, menu search, and an Editing/Viewing mode.
- **General access:** "Anyone with the link" (viewer or editor) plus Copy link.
- **Document outline:** clickable headings sidebar that highlights the current section.
- **Template gallery:** 7 starter templates with live previews.
- **Write with AI:** create a document from a prompt; draft, continue, improve, shorten, expand, fix grammar or change tone of a selection, always with a preview before applying (free models via OpenRouter; Grok can be pinned with `AI_MODEL`).

**Incomplete / intentionally cut:**
- Suggestion mode.
- Multiple tabs inside one document (only the headings outline is built).
- Character-level simultaneous co-editing. Presence, live refresh and conflict protection are implemented with polling instead.
- Real authentication (mocked with seeded users).

**Next 2–4 hours:**
- Stale-write detection (409 with a reload prompt).
- Version history with restore.
- A presence indicator.
- A committed Playwright end-to-end test in CI.
