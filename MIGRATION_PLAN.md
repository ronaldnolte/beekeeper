# Migration Plan: Google Antigravity → Claude Code (Beekeeper)

Vite/React/Tailwind/Capacitor app, Supabase backend. Migrating the coding
workflow from Google Antigravity (cloud IDE, Gemini) to Claude Code (local).
Plan created 2026-06-09 in a prior Claude Code session.

## Status

- [x] **Phase 1 — Install Claude Code**
  - Installed, authenticated (ron.nolte@gmail.com), updated v2.1.114 → v2.1.170 on 2026-06-09
- [ ] **Phase 2 — Set up the project (copy-on-demand scheme, decided 2026-06-09)**

  **HARD RULE: the live `E:\Antigravity\Beeks\Beekeeper\` folder is a
  READ-ONLY SOURCE. Never write to it. It is the backup, by construction.**
  All work happens in `E:\claude\beeks`, built file-by-file from the source's
  dependency graph. Files never copied across are dead code — they stay behind
  (nothing is ever deleted from the source). At the end, diff source vs. new
  tree and have Ron confirm the leftovers are genuinely unused.

  - [x] Create empty `E:\claude\beeks` + `git init` (done 2026-06-09; seeded with CLAUDE.md and source `.gitignore`, committed)
  - [x] Copy entry points/config: `package.json`, `package-lock.json`, `index.html`, `vite.config.ts`, tsconfigs, ESLint config, `capacitor.config.ts` (also took `jest.config.cjs`, `vercel.json`, `app.json`) — done 2026-06-09
  - [x] Copy `.env` manually (invisible to builds; not import-reachable; gitignored) — done 2026-06-09
  - [x] Copy `src/` following the import graph from `src/main.tsx`; copy `api/` functions — done 2026-06-09. Traced the real import graph with `E:\claude\trace-imports.mjs` (entries: `src/main.tsx` + all 6 `api/*.ts`, since the serverless API functions import back into `src/features/nectar/*`). Copied 51 `src/` files + all 6 `api/` files.
  - [x] Copy non-import-reachable assets deliberately: `public/` (4 files), `icons/` (7 files). **`src/assets/` skipped** — its only 3 files are dead Vite-template leftovers (see reconciliation).
  - [x] Copy `android/` (Google Play native wrapper) — done 2026-06-09 via `tar` pipe excluding artifacts. Copied 12 MB (project + signing files) instead of the 178 MB source (left `app/build`, `.gradle`, `local.properties` — regenerable/machine-specific). Release identity preserved: `applicationId com.beektools.beekeeper`, `versionCode 68`, `versionName 1.5.17`. Signing files (`app/@rnolte__tbh-beekeeper.jks`, `keystore.properties`) are on disk but gitignored (like `.env`) — **the .jks is the irreplaceable Play upload key; back it up separately.** `local.properties` (Android SDK path) must be regenerated per machine before a Gradle build.
  - [x] Do NOT copy `node_modules/` or `dist/` — run `npm install` fresh (910 pkgs, clean) — done 2026-06-09
  - [x] Verify continuously: `tsc -b` ✓, `vite build` ✓ (1978 modules), `npm run test` ✓ (13/13) — all green 2026-06-09
  - [x] Final reconciliation — DONE 2026-06-09 via the git graft. Compared working tree against
    `origin/main`; Ron confirmed the drops. Net delta committed: +3 (CLAUDE.md, MIGRATION_PLAN.md,
    .claude/settings.json), -9 (App.css, 3 src/assets template leftovers, nectar/geo.ts,
    ndviHistory.json, .cursorrules, schema.json, test_db.js), 1 modified (package-lock.json regen).
    Operational files the import-trace had skipped were re-copied and kept (README.md,
    docs/google-analytics.md, build-local-aab.ps1, assets/icon.png + splash.png, eas.json, .easignore).

  ### Dead-code candidates (never copied — confirm before deleting from source)

  Import-graph trace from `src/main.tsx` + all `api/*.ts` left these 6 `src/`
  files unreached and unreferenced:
  - `src/App.css` — imported nowhere (Vite-template leftover)
  - `src/assets/hero.png` — referenced only by the dead `App.css` `.hero` rule
  - `src/assets/react.svg`, `src/assets/vite.svg` — Vite-template leftovers, referenced nowhere
  - `src/features/nectar/geo.ts` — imported nowhere (the live geo helper is `src/features/nectar/geo`? no — confirm; engine uses none of it)
  - `src/features/nectar/ndviHistory.json` — referenced nowhere in code (may be historical seed data the deployed API loads by path — **verify before deleting**)

  Two files the tracer flagged but ARE needed and were copied: `src/index.css`
  (side-effect `import './index.css'` in `main.tsx`, which the tracer doesn't
  follow) and `src/features/nectar/__tests__/engine.test.ts` (needed by `jest`).
  - [ ] Expand CLAUDE.md in `E:\claude\beeks` (seed exists; run `/init` there to flesh it out)
  - [x] Migrate `.cursorrules` rules into CLAUDE.md seed:
    - No-BS communication style
    - Never guess column names — always check schema
    - Shared Supabase DB between Beekeeper and TBH Beekeeper
- [x] **Git connection — DONE 2026-06-09.** Working copy now has `origin →
  github.com/ronaldnolte/beekeeper.git`, branch `main` grafted onto `origin/main` and pushed
  (`96eba54..414fff5`, clean fast-forward). Old fresh-init scaffolding commits are orphaned (reflog only).
- [x] **Phase 3 — Commit/push workflow — DECIDED 2026-06-09.** Ron chose manual commits with
  his approval (NOT a hook). Claude commits + pushes at meaningful milestones with descriptive
  messages, but asks Ron before each commit/push. No PostToolUse auto-push hook. Rationale:
  preserves clean, meaningful history and control vs. Antigravity's noisy auto-push.
- [x] **Phase 4 — Verify environment variables** ✅ done 2026-06-09
  - `.env` confirmed intact: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, GOOGLE_GENERATIVE_AI_API_KEY,
    AGRO_API_KEY, GOOGLE_CLIENT_ID, GOOGLE_GROUP_EMAIL, GOOGLE_ADMIN_EMAIL, GOOGLE_SERVICE_ACCOUNT_KEY.
  - `npm run dev` smoke test passed: Vite ready in ~1.7s on :5173; `/` returns 200 with the real SPA
    shell, `/src/main.tsx` transforms (200), deep route falls back to index.html (200, SPA routing OK).
- [x] **Phase 5 — Google Earth Engine auth** ✅ VERIFIED 2026-06-09 (was tagged biggest risk; resolved)
  - NOT dependent on Antigravity ambient creds. Auth is self-contained: `api/ndvi-fetcher.ts`
    calls `ee.data.authenticateViaPrivateKey(JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY))`.
  - `GOOGLE_SERVICE_ACCOUNT_KEY` in `.env` is intact and well-formed: `type service_account`,
    project `gen-lang-client-0470919167`, client_email
    `beta-group-manager@gen-lang-client-0470919167.iam.gserviceaccount.com`, valid PEM private_key.
  - **Live round-trip confirmed**: authenticateViaPrivateKey → initialize → `ee.Number(40).add(2)`
    evaluated to 42 server-side (auth 223ms). The SA still has live Earth Engine access; no
    `gcloud auth application-default login` needed.
  - Other Google vars present in `.env` for the beta/notify flows: `GOOGLE_GENERATIVE_AI_API_KEY`,
    `GOOGLE_CLIENT_ID`, `GOOGLE_GROUP_EMAIL`, `GOOGLE_ADMIN_EMAIL`, plus `AGRO_API_KEY`,
    `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- [x] **Phase 6 — Validate — DONE 2026-06-09.** `tsc -b` ✓, `vite build` (1978 modules) ✓,
  `npm run test` (jest 13/13) ✓, `npm run dev` ✓ (login works, SPA serves), live GEE auth ✓,
  full Nectar Flow pipeline ✓ (local + production). **Production deploy verified**: push to
  GitHub `main` auto-deployed via Vercel; `https://beekeeper.beektools.com/` returns 200 serving
  the migrated SPA, and prod `/api/nectar-index` returns real GEE data (deployed serverless + EE auth OK).

## ✅ MIGRATION COMPLETE (2026-06-09)

All phases done. The Beekeeper app is fully migrated from Google Antigravity to Claude Code:
working copy at `E:\claude\beeks`, connected to `github.com/ronaldnolte/beekeeper.git` (branch
`main`), verified build/test/dev/GEE/nectar, and confirmed live in production via Vercel.
`E:\Antigravity\Beeks\Beekeeper\` remains the untouched read-only backup.

Possible follow-ups (separate projects, not part of this migration): Capacitor 6→8 upgrade
(fixes the high-sev `tar` advisory), migrate the deprecated `@google/generative-ai` SDK to
`@google/genai`, `npm audit fix`, and optionally add `tsx` + a `dev:api` npm script for the
local nectar server.

## Design constraints (stated by Ron 2026-06-09)

- **The app is published on Google Play** (Android, via Capacitor — appId
  `com.beektools.beekeeper`). Don't break the Capacitor/Android packaging path;
  release signing and the Play listing depend on it.
- **Keep the app a SPA.** No SSR/MPA/file-based-routing migration. The web
  target is a Vercel-hosted SPA (`vercel.json` already rewrites all routes to
  `/index.html`), and Android wraps that same `dist/` SPA. Any future routing
  must stay client-side.

## What stays unchanged

Source code, Supabase integration, the Vite/React/Tailwind/Capacitor stack,
`@google/generative-ai` (in-app Gemini features), VS Code config (`.vscode/`).

## Dependency review (2026-06-09)

Stack is healthy overall: React 19, Vite 8, Tailwind 4, TypeScript 6, zustand 5,
Supabase JS v2 — all on current majors, only minor/patch updates behind.

Findings, in priority order:

1. **Capacitor 6.2.1 — two majors behind (latest 8.4).** Biggest gap. Also the
   only way to fix the high-severity `tar` advisory in `@capacitor/cli`
   ("no fix available" at v6). Treat as a separate upgrade project after the
   migration, not part of it.
2. **`@google/generative-ai` 0.24.1 is a deprecated SDK** (used in
   `api/chat.ts`). Google replaced it with `@google/genai`. Works today;
   migrate eventually.
3. **`@google/earthengine` + `xmlhttprequest`** are used only in
   `api/ndvi-fetcher.ts` (server-side API functions, not the browser bundle).
   `xmlhttprequest` is an ancient XHR polyfill for Earth Engine in Node.
   Confirms Phase 5: GEE auth is server-side — matters wherever `api/` runs.
4. **`npm audit`: 16 vulnerabilities (9 high, 7 moderate)** — all transitive,
   nearly all in dev/build tooling (Capacitor CLI/assets, `tmp`, `replace`,
   `ws`) plus earthengine's `googleapis` chain. Nothing in the shipped browser
   bundle. Run `npm audit fix` (no `--force`) in the working copy; the rest
   need the Capacitor upgrade or an earthengine downgrade (don't).
5. Routine minor updates available: supabase-js 2.103→2.108, vite 8.0.8→8.0.16,
   lucide-react 1.8→1.17, react 19.2.5→19.2.7, zustand, tailwind 4.2→4.3.
   `npm update` in the working copy covers these.

Dependency usage map: browser app (`src/`) uses react, react-dom, zustand,
@supabase/supabase-js, lucide-react, react-markdown, @capacitor/app,
@capacitor/core. Server functions (`api/`) use @google/earthengine,
xmlhttprequest, @google/generative-ai, @supabase/supabase-js.

## Notes

- Source `.gitignore` ignores `*.js` globally and `.env*` — remember when
  copying: compiled JS isn't tracked, and `.env` must be hand-carried.
- Fable 5 connection error at end of prior session was right after the Claude
  Code update, before restart — resolved in the next session.
- Fable 5 is free on the current plan until 2026-06-22; do heavy migration
  work before then.
