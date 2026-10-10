# Beekeeper Security & Quality Review

Full review conducted 2026-07-01. Covers security, technology choices,
database structure, and UI consistency, with prioritized fixes and
enhancement ideas. Living document — check items off as they're resolved and
add notes on decisions made along the way.

Status legend: ✅ Done · 🟡 In progress / partially done · ⬜ Not started

---

## Part 1: Prioritized Issues

### CRITICAL

**1. ✅ DONE (2026-07-01) — Live email API key hardcoded in source, committed to git history.**
The Resend key `re_RRkAoNA9...` was a fallback in `api/feedback.ts`, `api/beta.ts`,
and `api/notify-signup.ts`. Confirmed production had never had `RESEND_API_KEY`
set in Vercel at all — it was running on this exact key.
- ✅ New key created at Resend (Sending access, restricted to `beektools.com` domain)
- ✅ `RESEND_API_KEY` added in Vercel for Production and Preview
- ✅ Preview redeployed + verified via a real `/beta` signup (both emails received)
- ✅ Production redeployed (same code, new secret only) + verified live
- ✅ Old leaked key ("Onboarding") deleted at Resend — now permanently dead
- ⬜ **Remaining:** the literal (now-harmless) string still sits in `main`'s
  source until `develop` is merged in — see item 2's code fix.

**1b. ✅ DONE (2026-07-03) — the "anyone can delete any account" hole was STILL OPEN on production and is now truly closed.**
The most serious finding of the whole review. A leftover admin function,
`delete_user_entirely`, could be called by anyone on the internet with no
login — wiping any user's account and all their data. A fix was written months
ago (migration 0004) and everyone believed it was closed. It was NOT: it
revoked access from the "anonymous" and "signed-in" groups but missed the
underlying database default that grants **"everyone"** permission to call a
new function — a separate switch the original fix never touched. So the hole
was live on the real production database for ~2 weeks.
- Found 2026-07-03 because the fresh production clone ("Beekeeper Dev v2")
  still flagged it, which led to checking production itself — same flag.
- Verified directly (not via the sometimes-cached dashboard) that anonymous
  callers really could still reach it.
- Fixed by revoking from the "everyone" (`public`) grant, not just the two
  named groups. Re-verified straight from the database: anonymous access is
  now `false` on all four affected functions. No evidence it was ever abused.
- Still to do (low priority): apply the same corrected fix to the two
  practice databases, and — when the schema gets saved into the project's
  code — write a corrected version so this can't quietly come back.

### HIGH

**2. 🟡 PARTLY fixed — verified in the actual code 2026-07-03, not just from memory.**
Originally: the AI chat feature, the voice-note transcription feature, the
feedback form, AND the two weather-forecast (nectar) endpoints could all be
used by anyone on the internet with no login and no limit, running up paid
Google usage and risking the app getting locked out when a quota is hit.
- ✅ **Confirmed fixed:** chat, voice-note transcription, and feedback now all
  require a real login before doing any paid work — checked directly in the
  code, not assumed. Sits on the practice branch, not yet on the real site.
- ❌ **NOT fixed, still exactly as first described:** the two weather-forecast
  endpoints still accept a request from anyone, with no login and **no limit
  on how many times it can be called** — confirmed by checking the code
  directly, there is no rate-limiting anywhere in the project. Someone could
  still hammer these with made-up locations and run up real cost today,
  unchanged from the original finding.
- ⬜ Bring the login-required fixes to the real live site (needs the practice-
  branch-to-real-site move).
- ⬜ Add an actual limit on how often the weather-forecast endpoints can be
  called — genuinely not started.

**3. 🟡 Same batch of fixes — outside websites could call every one of these features directly.**
Now restricted to only the app's real web addresses. Same status as #2 above
— built and tested, waiting to reach the real live site.

**4. 🟡 PARTLY fixed — verified in the actual code 2026-07-03.**
Originally: the beta-signup form would email *any* address immediately, no
limit, and gave away whether an address was already signed up.
- ✅ **Confirmed fixed:** stricter checking of what counts as a valid email
  address, and it no longer reveals whether an address already signed up.
- ❌ **NOT fixed, still exactly as first described:** there is still no limit
  on how many times someone could submit this form, and no check that a real
  human (not a script) is filling it in. Someone could still write a script
  today to blast real welcome emails to thousands of made-up or stolen
  addresses, unlimited times, with the live site exactly as it is right now.
- ⬜ Add a limit on submissions + a simple "prove you're human" check
  (something like Cloudflare's free, mostly-invisible check) — genuinely not
  started, on both this and the weather-forecast endpoints above.

**5. ✅ DONE (2026-07-02) — `/api/notify-signup` was open if `WEBHOOK_SECRET` was ever unset.**
Code fix (fails closed if the secret isn't configured, escapes payload fields)
sits on `develop`, same as items 2–4. But the operational fix — actually
closing the live gap on production, ahead of any merge — is complete:
- ✅ Generated a fresh `WEBHOOK_SECRET`, set it in Vercel for Production and
  Preview
- ✅ **Bonus find along the way:** the Supabase "notify-new-signup" database
  webhook (schema `auth`, table `users`, INSERT) was pointing at
  `https://app.beektools.com/api/notify-signup` — `app.beektools.com` 308-
  redirects to the static marketing site (`beektools.com`), which has no such
  route. This notification had almost certainly been silently failing
  regardless of the auth issue. Corrected to `https://beekeeper.beektools.com/api/notify-signup`
  and added the matching `Authorization: Bearer <secret>` header, same edit.
- ✅ Redeployed Production once, after both sides (Vercel env var + Supabase
  webhook header) already agreed — no gap in between.
- ✅ Verified end-to-end with a real test signup on production — the
  "New BeekTools User Signup" notification arrived correctly.
- Preview was skipped for this one (confirmed Database Webhooks was never
  even enabled on the "Beekeeper Dev" Supabase project — nothing to test or
  break there).

### MEDIUM

**6. ⬜ Core database schema/RLS policies exist only in the live database, not in git.**
Only the newer features (inspection attachments, June hardening) have migration
files. The tables that matter most (apiaries, hives, inspections, tasks,
varroa_tests, user_roles) and their RLS policies were hand-created and are
unauditable from the repo.
- **Action:** `supabase db pull` (or dump from the SQL editor), commit as a
  baseline migration. All future schema changes go through migration files.
- **Mentor schema — decision reversed 2026-07-02: KEEP it, do NOT drop.** The
  mentor *UI* was removed, but `mentor_profiles`, `apiary_shares`, and the
  viewer-read RLS policies are the read-only apiary-sharing infrastructure, and
  Ron is reconsidering a no-messaging sharing revival. Verified there is no
  comms/chat table anywhere (the youth-safety risk was never built), so it's a
  lower-risk feature than what was set aside. If revived it needs *finishing*
  (viewer policies were never added to inspections/interventions/varroa_tests)
  and the three `check_hive_access` overloads consolidated. Parked, not dropped.

**7. ✅ DONE — Apiary deletion is now safe at the database level, live on production (2026-07-03).**
Previously, deleting an apiary meant the app had to manually delete child
records one table at a time (11 separate steps), then double-check each one
actually worked, because the database itself didn't enforce the cleanup.
- The database update that fixes this (recorded as `supabase/migrations/0005_cascade_deletes.sql`
  and `0006_tasks_cascade.sql` in the project's code, for anyone who needs the
  exact technical record) now makes the database clean up automatically:
  deleting an apiary removes its hives, and each hive's inspections,
  interventions, snapshots, varroa tests, and tasks, all in one atomic step.
- **Fully tested before going live:** applied and checked on a practice copy
  of the database (2026-07-02), then applied and checked again on a brand-new
  full copy of real production data (2026-07-03) — including an actual test
  where we deleted one of Ron's own real apiaries and confirmed every single
  related record disappeared correctly, with nothing left behind and nothing
  extra removed.
- **Applied to the real, live production database on 2026-07-03**, verified
  with a full 25-point data-integrity scan showing zero problems.
- **A related bug was found and confirmed (still needs fixing, separate from
  the above):** deleting an apiary today correctly removes the database
  records, but does **not** delete the actual photo/voice-note files sitting
  in file storage — only a different, single-inspection cleanup path does
  that. So old photos/audio from a deleted apiary are left behind, unused,
  taking up space. Fix planned alongside simplifying the app's delete code
  (below).
- **Remaining step:** simplify the app's own delete code now that the
  database handles the cleanup automatically, and fix the leftover-files bug
  above in the same pass. Not done yet — this is app code, not a database
  change, and needs its own testing pass before it reaches production.

**NEW: Storage (photos/voice notes) has no backup at all.** Daily DB backups
explicitly exclude Storage objects. No existing toggle covers this — it would
be new engineering work. Options, cheapest/simplest first: (1) soft-delete
with a grace period before actually purging from Storage — cheap, covers the
common "oops" case; (2) a scheduled sync job copying the bucket to a cheap
secondary location (e.g. Backblaze B2/S3) — real disaster-recovery coverage;
(3) both together. Recommend starting with (1). Not started.
- Reusable health check: `supabase/db_integrity_audit.sql` — run in any SQL
  editor anytime to re-verify integrity.

**8. 🟡 Error responses leaked internal details to callers.**
Fixed as part of the develop commit — errors are now logged server-side and a
generic message is returned to the client. Pending merge to main.

**9. 🟡 Email HTML injection via unescaped reply-to address.**
Fixed as part of the develop commit (`escapeHtml` helper in `api/_lib.ts`).
Pending merge to main.

**10. 🟡 Weak password floor (6 characters).**
Client-side minimum raised to 8 on develop.
- ⬜ Consider also enforcing this server-side in Supabase Auth settings, and
- ⬜ Enable "Leaked password protection" in Supabase Auth settings (noted in
  migration 0004's comments but never actually turned on).

### What's already good on security
Worth restating: the June hardening migration closed a genuinely critical hole
(anonymous account-wipe function), the storage bucket is private with correct
owner-only path policies, the attachments table has proper owner-scoped RLS,
the client only ever uses the public "anon" key (no service-role key anywhere
in this codebase), and `main` is protected by a GitHub ruleset requiring PR
review. The foundation is sound.

---

## Part 2: Technology Choices

- **Frontend (Vite + React 19 + TypeScript + Tailwind 4 + Zustand + Capacitor):**
  good fit for a solo maintainer shipping web + Android from one codebase.
  ⬜ Navigation is a hand-rolled view switcher with manual `history.pushState`
  logic in three places — works, but fragile and blocks deep-linking.
  ⬜ Test coverage is essentially one file (the nectar engine) — forms and
  repositories that guard user data have none.
- **Hosting (Vercel serverless + GitHub auto-deploy):** good choice, branch
  discipline (`develop`→preview, `main`→production behind a PR) is well-designed.
  ⬜ The Earth Engine client + XMLHttpRequest polyfill inside a serverless
  function is heavy/fragile — worth watching if nectar-index reliability
  becomes a complaint.
- **Database (Supabase Pro):** good fit for the per-user RLS-driven data model.
  ⬜ **Open TODO carried over from BUILD_BRIEF.md:** an actual database restore
  has never been tested. Worth an afternoon.
  ⬜ Unconfirmed which database the preview stack points at (frontend
  separation is clean; DB separation needs confirming).
- **AI (Gemini 2.5 Flash via serverless proxy):** good architecture (key stays
  server-side). Context given to the chat assistant is currently thin — see
  enhancements below.
- **Email (Resend):** good choice, now correctly configured (see Critical #1).

---

## Part 3: Database Structure

Ownership model is clean: `apiaries` (user_id) → `hives` → five record types
(inspections, interventions, tasks, varroa_tests, hive_snapshots), access
gated through `check_hive_access()`. Supporting tables (user_roles,
weather_forecasts cache, feedback/roadmap, beta_signups) are sensibly separate.
`inspection_attachments` is the best-designed table in the system — UUID key,
cascading deletes, indexes, complete RLS.

Weaknesses, in order:
1. ⬜ Schema not in version control (Medium #6 above) — the biggest one.
2. ⬜ No cascading deletes on the core chain (Medium #7 above).
3. ⬜ Inconsistent key types — `inspections.id` is text while newer tables use
   UUID. Not worth a risky migration now; just don't repeat the pattern —
   all new tables should use `uuid default gen_random_uuid()`.
4. ✅ Removed dead mentor system — see Medium #6's cleanup note. (Feature
   itself confirmed removed from all app code; DB scaffolding is the one
   remaining piece, folded into the schema-baseline task above.)

---

## Part 4: Ease of Use and UI Consistency

Real design system in place: CSS variables for theming, shared `.card` /
`.btn-honey` classes, reusable list/selection components. Navigation structure
is coherent, loading states are uniform, safe-area insets handled correctly
for Android.

Inconsistencies found:
1. ⬜ Two different brand ambers — theme defines `#E99B1A`, but the bottom nav
   and all outgoing emails use `#F5A623`. Pick one, route through the CSS variable.
2. ⬜ Bottom nav bar is overloaded (8 items) and **Log Out sits one accidental
   tap away with no confirmation.** Move Feedback/Log Out into a
   Settings/profile screen — the app already half-expects one (`AppHeader`
   has a title mapping for a `SETTINGS` view that doesn't exist yet).
3. ⬜ Outdated copy — login screen still says "Manage your top-bar hives with
   ease," a leftover from the app's earlier TBH-only era; now supports 9 hive types.
4. ⬜ Accessibility gaps — icon-only buttons lack labels, some text sizes
   (9–10px) are below comfortable minimums.
5. ⬜ No visible Settings/account area — also the natural home for a privacy
   policy link and contact email, which Play Store policy expects for an app
   with account creation (see Google Play note below).

---

## Part 4b: Nectar Index Performance (reviewed 2026-07-02)

Traced the full path: `NectarFlowV2View` → `/api/nectar-index-v2` →
`fetchMultiBands` (Earth Engine) + `fetchWeatherV2` (Open-Meteo, already
parallel via `Promise.all`) → `runV2Pipeline` (pure compute) → chart. The
active path is V2; V1 (`/api/nectar-index`, `NectarFlowView`) is dormant but
still in the repo.

**DONE on `develop` (commit `a497a46`, pushed — pending Ron's AM confirmation
on preview + local dev):**
- ✅ **Dev double-fetch / stale-data race.** The fetch effect had no cleanup,
  so React StrictMode's dev double-invoke fired *two* concurrent Earth Engine
  calls per load, and in prod an abandoned load (apiary switch / refresh mid-
  flight) could overwrite fresher data. Added an `AbortController` that cancels
  the in-flight request on effect re-run/unmount. Visible win in dev (2→1
  call); also a real prod correctness fix. Verify: Network tab shows one
  `nectar-index-v2` call; rapid apiary switch shows the prior as cancelled.
- ✅ **Growing Earth Engine window.** Replaced the hardcoded `2023-01-01`
  start with a rolling `(currentYear - 3)` window (mirrors the V1 fix). NOTE:
  `2026 - 3 = 2023`, so this is a **no-op for 2026** — identical output/perf
  today; it only starts helping in Jan 2027 by capping the window. Correctness
  + future-proofing, not a today-speedup. Today's speedup is the abort fix.

**Still open (target the chart *interaction* lag, not load time — deliberately
held back so the above tests stay isolated):**
- ⬜ **No memoization.** `years`, `historyCurrent`, the 365-slot
  `historyBaseMap`, and `historyBase` re-derive by looping the full ~1,280-pt
  history on *every* render — and `hoveredIndex` changes on every pointer move,
  so all of it recomputes on every pixel of a chart drag. Wrap in `useMemo`
  keyed on `data`.
- ⬜ **Repeated linear `.find()` + Date allocs on hover.** `getDayOfYear`
  builds two `Date`s per call and is used inside `.find()` predicates run
  several times per hover (some duplicated 2× in one expression, e.g. the
  fullscreen panel). Precompute a day-of-year→value map once for O(1) lookups.
- ⬜ **Static chart geometry redrawn per hover.** Area/baseline/segment paths
  rebuild every render though only the thin hover cursor changes. Separate the
  fixed geometry from the moving cursor overlay.
- ⬜ **Redundant Supabase coord fetch per load.** `fetchApiaryWithCoords`
  re-queries the DB for `lat/lng/zip` that are already in `apiariesList` in the
  store. Reading from the store removes a network hop before the slow
  serverless call — but has a subtle staleness tradeoff (store isn't refreshed
  after an apiary-location edit), so do it with a fallback. Lower priority.
- ⬜ **Engine `interpBand` resets its scan pointer per day** (`nectar-v2-
  engine.ts`), making it ~O(days × scenes), called 3× (NDVI/EVI/NDWI). Hoist
  the pointer to make it linear. Small today, grows with the window.
- ⬜ **Payload could pre-aggregate the baseline server-side** (send current-
  year daily + a day-of-year baseline) instead of all ~1,280 daily points the
  client then collapses. Bigger refactor; enhancement, not a fix.

---

## Part 5: Potential Enhancements

Roughly ordered by field value to a beekeeper:

1. ⬜ **Offline support** — queue writes locally when out of cell range at the
   apiary, sync on reconnect. Probably the single most field-valuable improvement.
2. ⬜ **Task/treatment reminders** — local notifications off existing tasks/
   interventions data (Capacitor has a first-party plugin).
3. ⬜ **Richer AI context** — feed the chat assistant the hive's recent
   inspections/varroa counts instead of just hive type + season; the data's
   already in the database and the proxy pattern already supports it.
4. ⬜ **Weather-driven alerts** — freeze warnings, good-inspection-window
   suggestions, treatment-temperature windows.
5. ⬜ **Deep links / real router** — shareable links, simpler back-button logic.
6. ⬜ **Data export (CSV/JSON)** — the PDF report is a strong start; full
   "download my data" builds trust and covers data-portability expectations.
7. ⬜ **iOS build** — mostly configuration + an Apple developer account; the
   image pipeline was explicitly designed to survive this.
8. ⬜ **Dark mode** — CSS-variable theming makes this a few dozen lines.
9. ⬜ **Operational visibility** — error tracking (Sentry free tier) + a CI
   check (`tsc -b && vite build && npm test`) on every PR.
10. ⬜ **"What's New" popup on first login after an update** (Ron: existed in
    an earlier version, lost in the rebuild — cannot check the old source, see
    project notes). Design sketch: version history as a hand-edited
    `src/data/releaseNotes.ts` ({version, date, highlights[]}) — only entries
    that exist there trigger the popup, so routine version bumps stay silent
    and only real announcements show. Track "last seen" via one new column
    (`users.last_seen_release_version`, not localStorage, so it syncs across
    web + Android) compared against the newest entry at login, right where
    `loadNavigationContext`/`loadUserRoles` already fire in useAppStore. Small:
    one migration column + one data file + one popup component.

---

## Google Play Review Exposure

Server-side security issues (everything in Part 1) are invisible to Google's
human review — they never see server code. Two adjacent gaps are genuine
Play-policy flag risks:
- ⬜ **Account deletion** — Play requires an in-app (or linked, declared) path
  to delete an account for apps with account creation. Currently "handled
  manually/by email" (`public/delete-account.html`), which doesn't satisfy the
  policy. **Not starting from scratch:** a `delete_user_entirely(uuid)`
  function already exists in production from the earlier admin-panel build —
  currently locked down (execute revoked, see Critical-adjacent finding in the
  June hardening migration) because it has no caller-ownership check. Needs
  that check added, and an audit of exactly what it deletes, before it's
  reusable. Test account `ron.nolte+test1@gmail.com` (with an apiary + hive
  attached) is earmarked to validate this when it's built — see project notes.
- ⬜ **Privacy policy** — required link in the Play listing; no in-app privacy/
  terms page currently exists.
- ⬜ Confirm the Data Safety form accurately declares Google Analytics collection.

---

## Suggested Working Order

1. ~~Rotate the leaked email key~~ ✅ done.
2. ~~Fix the new-signup notification (wrong secret + wrong web address)~~ ✅ done.
3. ~~Make apiary deletion clean up automatically at the database level~~ ✅ done
   and live on the real production database.
4. Bring all the practice-branch security fixes (login required on the AI/
   feedback features, the junk-mail-relay fix, cleaner error messages,
   stronger passwords) over to the real live site — whenever ready.
5. Simplify the app's own delete code now that the database handles cleanup,
   and fix the leftover-photo-files bug in the same pass.
6. Get the database's actual structure saved as code in the project (it only
   lives in the live database today) + decide on the leftover mentor-matching
   tables — bundle together, prove on the practice database first.
7. Everything else rides normal feature work, or pick off whatever's most
   useful next time we sit down with this list.
