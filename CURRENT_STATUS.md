# Beekeeper Cleanup — Current Status (updated 2026-07-05)

Quick-start handoff. Full detail in `SECURITY_REVIEW.md`. Plain-language names:
**live site** = production (beekeeper.beektools.com, `main` branch, "Beekeeper"
database). **Preview** = test website (`develop` branch). **Beekeeper Dev v2** =
the new test database (a copy of production made 2026-07-03).

## ✅ Done and live on the real site
- **Account-deletion hole CLOSED** (was the worst issue: anyone could wipe any
  account — the old fix never actually worked; fixed + verified live).
- Leaked email key rotated and dead.
- New-signup notification email fixed.
- Automatic cleanup when deleting an apiary (cascade deletes) — live + tested.
- **Rate-limiting / bot-check + nectar login requirement — LIVE (2026-07-05).**
  Beta-signup form got a hidden trap field + a 3-per-10-min-per-IP limit. Both
  weather/nectar endpoints now require login (paid Earth Engine + weather work);
  cache changed to browser-only so cached responses can't bypass the check.
  A grace window (`NECTAR_AUTH_GRACE_UNTIL=2026-07-19` in Vercel Production)
  lets old installed apps keep loading Nectar until then; after that they get a
  plain-text "update Beekeeper" message. No new database table or vendor.
- **All `develop` security hardening merged to `main` and live (2026-07-05).**
  Login required on AI assistant / voice transcription / feedback, restricted
  cross-site access, cleaner errors, stronger password floor, weather-outage
  failover, and the now-dead leaked-key string removed from live source.
- **What's New modal — LIVE.** One-time per-release popup; leads with photos +
  voice notes and export-for-safe-keeping. Android-only "keep your app updated"
  note.
- **1.5.26 app build (versionCode 77) BUILT from `main`, ready to upload.**
  (76/1.5.25 was already uploaded; 77 supersedes it. Same app content.)

## Remaining, in order of importance

### 1. Finish the in-flight release
- Upload the 1.5.26 AAB (`android/app/build/outputs/bundle/release/app-release.aab`)
  to Closed testing → Alpha → Create new release.
- Once Google approves it and it's live to testers, email them to update within
  2-3 days (`docs/tester-update-email.md`).
- After ~2026-07-19, once testers have moved, remove `NECTAR_AUTH_GRACE_UNTIL`
  from Vercel Production (it was saved Sensitive — delete + re-add to change).

### 2. Turn on Supabase "leaked password protection"
One dashboard toggle. Quick security win.

### 3. Fix orphaned photo/voice files on apiary delete
Deleting an apiary cleans up the database rows (cascade is live) but leaves the
actual photo/voice files stranded in Storage — a data/privacy leak. Bundle with
simplifying the now-redundant client `deleteApiaryWithCascade` code.

### 4. Photo / voice-note backups
Daily backups exclude Storage, so a user could lose images/recordings with no
recovery. Options: soft-delete grace period, or a scheduled bucket copy to a
cheap secondary (e.g. Backblaze B2/S3).

### 5. Finish Preview → v2 database switch, then delete old "Beekeeper Dev"
Change the **Preview-scoped** Vercel env vars (VITE_SUPABASE_URL + ANON_KEY)
to v2 — never touch live-site values — redeploy Preview, verify a signed-in
Nectar load works, then delete old dev. Split-brain largely de-risked
(2026-07-05): functions read the DB from env vars, web is same-origin, only the
native app hardcodes production — so this is mostly config now.

### 6. Save the database structure as code
Schema + RLS only live in the production DB today; nothing in the repo to
review or reproduce it. (Blocked on Docker for `db dump`; could assemble via
the Management API.)

### 7. Google Play compliance for a public launch
Not blocking while closed-testing-only, but required to graduate:
- Real in-app "delete my account" (reuse `delete_user_entirely` once an
  ownership check is added).
- In-app privacy policy page; confirm the Data Safety form is accurate.

## Lower priority
- Nectar chart interaction-lag polish (load time already fixed).
- Usability: two amber shades, Log Out too easy to hit (wants a Settings
  screen — already half-stubbed), outdated login copy, accessibility labels.
- Enhancements: offline support, reminders, richer AI context, weather alerts,
  deep links, data export, iOS build, dark mode, error tracking, mentor
  read-only sharing revival (schema KEPT, decision parked).
