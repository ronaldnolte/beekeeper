# Beekeeper Cleanup — Current Status (2026-07-03)

Quick-start handoff. Full detail in `SECURITY_REVIEW.md`. Plain-language names:
**live site** = production (beekeeper.beektools.com, `main` branch, "Beekeeper"
database). **Preview** = test website (`develop` branch). **Beekeeper Dev v2** =
the new test database (a copy of production made 2026-07-03).

## ✅ Done and live on the real site
- **Account-deletion hole CLOSED** (was the worst issue: anyone could wipe any
  account — the old fix never actually worked; fixed + verified live today).
- Leaked email key rotated and dead.
- New-signup notification email fixed.
- Automatic cleanup when deleting an apiary (cascade deletes) — live + tested.

## 🔴 URGENT — still live and exploitable right now
1. **No rate-limiting / bot-check** on the beta-signup form and the two
   weather-forecast endpoints. A script could blast welcome emails to strangers
   (hurts email reputation) or run up Google costs.
   **BUILT on `develop` 2026-07-05, awaiting the merge to `main` (#2) to go
   live.** What was built (no new table, no new vendors):
   - Weather endpoints now **require login** (same pattern as the AI
     assistant); cache changed from shared-CDN to browser-only so cached
     responses can't bypass the check. Verified: anonymous + forged tokens
     get 401.
   - Signup form got a hidden trap field ("website") + an in-memory
     3-per-10-minutes-per-IP limit. Verified: trap → silent discard,
     4th attempt → 429, other IP unaffected. Duplicate signups still
     re-send emails (Ron chose to keep as-is).
   - Local dev: both nectar routes now go through `local-api-server.js`
     (which loads `.env.development.local` over `.env` so dev login tokens
     validate); the v2-proxy-to-prod rule is gone.
   **Grace window handles the installed-app break:** env var
   `NECTAR_AUTH_GRACE_UNTIL` (an ISO date) lets old app builds — which don't
   send the login token — keep loading Nectar until the date passes; after it,
   they get a friendly plain-text "update Beekeeper" message right in the
   Nectar view. Merge sequence: set the var in Vercel Production ~3 days out,
   merge to `main`, ship the **76 / 1.5.25** app build (bumped on `develop`
   2026-07-05 — it sends the token), email closed testers to update within
   2-3 days, then let the grace expire. Web/PWA send the token already, so
   they're unaffected throughout. Anonymous calls during grace are rate-limited
   (20/10min/IP) so the cost gap stays blunted.
   (Play is at 75/1.5.24 as of 2026-07-05; codebase bumped to 76/1.5.25.)

## 🟠 HIGH — important, not "exploitable this second"
2. **Bring the built code fixes to the live site** (merge `develop` → `main`).
   Already built + tested on `develop`, just not live yet: login required on
   the AI assistant / voice transcription / feedback, restricted cross-site
   access, cleaner error messages, stronger password floor, weather-outage
   failover. This merge also removes the (now-dead) leaked key string from the
   live source. NOTE the split-brain DB access below before merging.
3. **Turn on Supabase "leaked password protection"** — one dashboard toggle.

## 🟡 MEDIUM — housekeeping / safety
4. **Finish the Preview → v2 database switch, then delete old "Beekeeper Dev".**
   IN PROGRESS. Local `.env.development.local` already switched to v2. STILL TO
   DO: (a) change the **Preview-scoped** Vercel env vars (VITE_SUPABASE_URL +
   ANON_KEY) from old dev to v2 — never touch the live-site values; (b) the
   **split-brain**: the browser app uses the Vite-built URL, but the `/api/*`
   serverless functions read the DB a different way at runtime and several have
   a HARDCODED production URL fallback — both paths must agree; (c) rebuild
   Preview + re-verify by inspecting the built site; (d) then delete old dev.
   v2 already got the account-deletion security fix (verified).
5. **Save the database structure as code** — it only lives in the live database
   today; nothing in the project to review/reproduce it.
6. **Simplify the apiary-delete app code** + fix the bug where deleting an
   apiary leaves its photos/voice files orphaned in storage.
7. **No backup for photos/voice notes** — daily backups exclude them.

## Google Play (app is only in closed testing; most users are web/PWA)
- Real "delete my account" feature (Play requires it; reusable groundwork
  exists in the `delete_user_entirely` function once given an ownership check).
- In-app privacy policy page. Confirm Data Safety form accuracy.

## Lower priority
- Nectar chart interaction-lag polish (load time already fixed).
- Usability: two amber shades, Log Out too easy to hit, outdated login copy,
  accessibility labels, no Settings screen.
- Enhancements: offline support, reminders, richer AI context, weather alerts,
  deep links, data export, iOS build, dark mode, error tracking, "What's New"
  popup, mentor read-only sharing revival (schema KEPT, decision parked).

## Suggested next-session order
1. Consolidate my saved notes (trim context load).
2. Build rate-limiting/bot-check (#1) — the one live-exploitable item.
3. Finish the Preview → v2 switch incl. the split-brain paths (#4).
4. Merge `develop` → `main` (#2) once #4 understood, bringing fixes live.
