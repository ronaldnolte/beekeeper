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

### HIGH

**2. 🟡 Code fixed on `develop` (commit `ef2be5e`), not yet merged to `main`.**
The AI endpoints (`/api/chat`, `/api/transcribe`) and feedback endpoint ran with
no login check — anyone on the internet could trigger paid Gemini calls or send
mail through the app. Fixed on develop: all three now require a verified
Supabase session before doing paid work.
- ✅ Fix written and committed to `develop`
- ✅ Verified via `tsc -b`, `vite build`, `npm test`, and manual module smoke-test
- ⬜ Merge `develop` → `main` via PR (whenever ready — this is the main remaining
  action item on this whole list)

**3. 🟡 Same commit — CORS was wide open (`Access-Control-Allow-Origin: *`).**
Now restricted to an allowlist (prod domain, Capacitor app origins, Vite dev)
via shared `api/_lib.ts`. Same status as #2 — done on develop, pending merge.

**4. 🟡 Same commit — `/api/beta` was an open email relay.**
Anyone could trigger a welcome email to any address and probe whether an
address was already registered. Fixed: stricter email validation, response no
longer reveals `alreadyExists`. Pending merge to main.

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
- **Bonus while doing this:** the old, now-fully-removed mentor feature left
  dead schema behind in *both* databases — `mentor_profiles`, `apiary_shares`,
  viewer-read RLS policies on apiaries/hives/hive_snapshots/tasks, and three
  overloaded `check_hive_access()` functions with divergent logic. Since the
  mentor feature is gone for good (not paused — see project notes), this is
  safe to drop as part of the same cleanup pass. Prove removal on preview first.

**7. ⬜ Apiary deletion is 11 separate client-side queries with manual verification.**
`apiaryRepository.ts` deletes child records table-by-table, then re-queries to
confirm the delete actually happened, because "RLS can silently block deletes."
- **Action:** add `ON DELETE CASCADE` to the hive→children and apiary→hives
  foreign keys (the newer `inspection_attachments` table already does this
  correctly). Once cascades exist, the client-side delete collapses to one
  statement — or wrap it in a single Postgres function for atomicity.

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

1. ~~Rotate the leaked key~~ ✅ done.
2. ~~Verify/fix `WEBHOOK_SECRET` + notify-signup webhook~~ ✅ done (also fixed a
   previously-unknown wrong-domain bug in the webhook URL along the way).
3. Merge `develop` → `main` (brings in auth-required endpoints, CORS
   allowlist, error-message cleanup — items 2–4, 8–10 above) — whenever ready.
4. Schema baseline + mentor-schema cleanup (item 6) — bundle together, prove
   on preview first.
5. Cascading deletes (item 7).
6. Everything else rides normal feature work, or pick off whatever's most
   useful next time we sit down with this list.
