# Beekeeper (Claude Code working copy)

Vite/React/Tailwind/Capacitor beekeeping app with a Supabase backend and
server-side API functions (Google Earth Engine NDVI, Gemini chat).

## Running locally

- **Web app:** `npm run dev` — Vite dev server (defaults to :5173).
- **Nectar index in dev:** the Nectar Flow view calls `/api/nectar-index`,
  which `vite.config.ts` proxies to `http://localhost:3001`. That port is
  served by `local-api-server.js` (a dev-only shim, gitignored — not in the
  repo, kept on disk). Start it with **`npx tsx local-api-server.js`**.
  - Use `tsx`, NOT `ts-node` — ts-node's ESM loader fails on this project's
    `moduleResolution: bundler` tsconfig; `tsx` resolves the `.ts`/`.js`
    imports cleanly.
  - Without it, the Nectar view fails with `ECONNREFUSED` on :3001. This is a
    local-dev gap only — in production `/api/nectar-index` is the deployed
    Vercel serverless function `api/nectar-index.ts`.
- Other `/api/*` routes proxy to production (`beekeeper.beektools.com`).
- Verify changes with: `tsc -b`, `vite build`, `npm run test`.

## Migration context (Google Antigravity → Claude Code, 2026-06-09)

This working copy was rebuilt file-by-file from a read-only source by tracing
the import graph (`src/main.tsx` + all `api/*.ts`), then grafted onto the
project's real git history. Full plan and status: `MIGRATION_PLAN.md`.

- **`E:\Antigravity\Beeks\Beekeeper\` remains a READ-ONLY SOURCE / backup.
  Never write to or delete from it.**
- Files never copied across are presumed dead code (see the reconciliation
  list in `MIGRATION_PLAN.md`); they stay in the source untouched.
- `node_modules/` and `dist/` are not tracked — run `npm install` fresh.

## Working rules (carried over from .cursorrules)

- No-BS communication style — direct, no filler.
- Never guess column names — always check the schema first.
- The Supabase database is shared between Beekeeper and TBH Beekeeper.
  Schema changes affect both apps.
