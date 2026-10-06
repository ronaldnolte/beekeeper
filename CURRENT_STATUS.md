# Beekeeper — Current Status (refreshed 2026-10-06)

Quick-start handoff. Security history in `SECURITY_REVIEW.md`. Plain-language
names: **live site** = production (beekeeper.beektools.com, `main` branch,
"Beekeeper" database). **Preview** = test website (`develop` branch), also at
**test.beektools.com**. **Beekeeper Dev v2** = the test database (a copy of
production, last refreshed 2026-09-29). Test copies show a striped "TEST SITE"
bar along the top; the live site never does.

The day-to-day priority list lives outside this repo, in Claude's notes
(open-items master list). This file is the summary.

## ✅ Done (selected; older history in SECURITY_REVIEW.md)
- **Account-deletion hole CLOSED** on production (2026-07-03).
- Leaked email key rotated and dead; signup notification email fixed.
- Cascade deletes when an apiary is deleted (database rows).
- Rate-limiting / bot-check on beta signup; login required on Nectar, Ask AI,
  voice transcription and feedback.
- Supabase "leaked password protection" turned on (2026-08-31).
- Preview switched to Beekeeper Dev v2 (2026-07-06).
- **Android:** 85 / 1.5.34 uploaded to Closed testing 2026-09-21.
- **On `develop`, not yet on the live site (2026-10-05/06):** startup loads
  6 database calls instead of 18–19; no repeat loads when revisiting screens;
  inspection photos load with fewer calls; map picker glides, zooms closer and
  draws above everything; "TEST SITE" bar on test copies; completed tasks
  listed newest first. Checklist: `E:\claude\beeks-compare\PORT-LIST.md`.

## Remaining, in order of importance

### 1. Promote `develop` to the live site
Open a pull request `develop` → `main` when Ron approves. It also carries the
two Android navigation-bar commits (55cd409, a67ad12), which only affect the
installed app, so they ship with the next Android build.

### 2. Photo / voice-note backups
Daily database backups exclude Storage, so photos and voice notes have NO
backup at all. Options: a scheduled bucket copy to cheap secondary storage, or
a soft-delete grace period. Also still to do: a restore drill, and checking
whether point-in-time recovery is on.

### 3. Fix orphaned photo/voice files on apiary delete
Deleting an apiary removes the database rows but leaves the photo/voice files
in Storage (a data/privacy leak).

### 4. Save the database structure as code
Schema and access rules only live in the database; nothing in the repo can
review or reproduce them.

Tooling on this machine, re-checked 2026-07-27: Docker, `pg_dump` and `psql`
are NOT installed; the Supabase CLI is only reachable via `npx supabase`. So
`supabase db dump` can't run. That's a missing-tools situation, not a decision
Ron made (he doesn't use Docker).

Three ways forward, none picked yet:
- Install the PostgreSQL client tools (client only, no server, no Docker),
  then `pg_dump` against the pooler. Cleanest output, one small install.
- Management API `POST /v1/projects/{ref}/database/query` with a personal
  access token. Nothing to install, proven to work here 2026-07-02, but the
  structure has to be assembled from query results.
- Dashboard SQL Editor, Ron pastes results back. Manual fallback.

### 5. Google Play: production access and compliance
- Production access needs 12 testers for 14 days (revisit Oct/Nov).
- Real in-app "delete my account" (reuse `delete_user_entirely` only after an
  ownership check is added).
- In-app privacy policy page; confirm the Data Safety form is accurate.

### 6. Clean-up
- Delete the old "Beekeeper Dev" Supabase project.
- Check: is `NECTAR_AUTH_GRACE_UNTIL` (2026-07-19) still set in Vercel
  Production? If so, remove it.

## Lower priority
- Usability: Log Out too easy to hit, outdated login copy, accessibility labels.
- Enhancements: reminders, richer AI context, weather alerts, deep links, iOS
  build, error tracking, mentor read-only sharing revival (schema KEPT).
- **Offline support: ELIMINATED (Ron, 2026-09-25).** Too much of the app needs
  a connection. Not losing a save when the signal drops is a separate,
  still-worthwhile robustness item.
