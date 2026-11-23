# Submission — Shaaban Abdullah, AI-Native Full Stack Developer

| Item | Location |
|---|---|
| Live app | _<Vercel URL>_ |
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
- **Template gallery:** 7 starter templates with live previews.
- **Write with AI:** create a document from a prompt; draft, continue, improve, shorten, expand, fix grammar or change tone of a selection, always with a preview before applying (free Grok via OpenRouter).

**Incomplete / intentionally cut:**
- Real-time co-editing: concurrent edits are last-write-wins.
- Comments and version history.
- Real authentication (mocked with seeded users).

**Next 2–4 hours:**
- Stale-write detection (409 with a reload prompt).
- Version history with restore.
- A presence indicator.
- A committed Playwright end-to-end test in CI.
