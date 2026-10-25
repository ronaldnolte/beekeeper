# Beekeeper — rules for the AI assistant

Read this file and HANDOVER.md before doing anything. These rules come from Ron, the
owner. Follow them exactly.

## The three environments (use these exact names)
| | Code (GitHub branch) | Website | Database (Supabase project) |
|---|---|---|---|
| **Test** | `develop` | test.beektools.com (Vercel "Preview") | **Beekeeper Dev v2** |
| **Live** | `main` | beekeeper.beektools.com ("Production") | **Beekeeper** |

Do not invent other names ("staging", "dev site", "practice").

## Hard rules — never break these
1. **Work only on the `develop` branch.** Never commit or push to `main`. GitHub blocks
   direct pushes to `main`; do not try to get around it.
2. **Nothing reaches the live site until Ron has tested it on test.beektools.com and says so.**
   Not even a one-line fix. Moving code to the live site is a request (pull request) from
   `develop` to `main` that **Ron merges himself**.
3. **Never touch the live database (Beekeeper).** No reads with keys, no writes, no schema
   changes, no migrations. All work uses Beekeeper Dev v2. This folder's `.env` points only at
   Beekeeper Dev v2 — never put the live address or key in it.
4. **Never run Vercel's command-line tool** (`vercel`, `npx vercel …`). It deploys to a wrong,
   separate project. Deploys happen automatically: push to `develop` → test site updates in a few
   minutes.
5. **Never write to or delete anything in `E:\Antigravity\`** (old read-only backup).
6. **Database changes are additive only** (new tables/columns), written as numbered files in
   `supabase/migrations/`, run on Beekeeper Dev v2 first. Check the real column names before
   writing any query — never guess.
7. **Phone (Google Play) releases are built from `main` only**, with the version number bumped
   first. See HANDOVER.md. The Android signing key is NOT in this folder on purpose.
8. **Before changing the Claude-related files `CLAUDE.md` or `.claude/`:** don't. They belong to
   another tool and are deliberately hidden from this folder's git status.

## Running and checking the app
- `npm install` once (node_modules is not copied).
- `npm run dev` — local web app at http://localhost:5173 (uses Beekeeper Dev v2).
- Before every push: `npx tsc -b`, `npx vite build`, `npm run test` — all must pass.
- Local `/api/*` calls are forwarded to the live site's server functions (see `vite.config.ts`),
  so AI features (transcription, summary, Ask AI) do NOT work properly locally — test them on
  test.beektools.com after pushing.
- After a push, Ron must **reload** the test site on his phone; an open page keeps the old version.

## How Ron wants to be talked to
- **Plain English, no abbreviations or jargon.** Say "the live site", "the test database",
  "the request to merge" — not "prod", "DB", "PR". Explain any technical name the first time.
- **Short.** The finding first in one line, then a clearly marked block of what Ron must do
  (numbered, one action per line), then brief context only if it changes a decision.
  Over half a screen is too long. Ron has ADHD; walls of text are a real barrier.
- **Walkthroughs: one small step at a time**, then stop and wait.
- **Check in often.** No long silent runs of commands; warn before anything slow.
- **Be specific:** exact account emails, project names, URLs. Never "your normal account".
  Check a dashboard's real menu path before telling Ron where to click.
- Text Ron must type exactly (URLs, values) goes in a code box.
- Never ask Ron to copy a long key out of the chat — point him at the copy button in the
  source dashboard (invisible characters break pasted keys).
- When offering choices to keep/drop things, always include a "none" option.
- If a documented procedure exists (e.g. the phone-app build), follow it — don't re-derive it.
- When Ron says "step by step", answer only what he asked; don't run ahead.
- Be honest: if something isn't tested or didn't work, say so plainly.
