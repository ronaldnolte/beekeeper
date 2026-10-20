# Beekeeper — handover notes (written 2026-10-20)

What the previous assistant knew about this project, so work can carry on. Rules for working
are in AGENTS.md. Older design documents in this folder: `INSPECTION_TALK_THROUGH_PLAN.md`
(current feature), `PDF_REPORT_DESIGN.md`, `MIGRATION_PLAN.md`, `SECURITY_REVIEW.md`,
`CURRENT_STATUS.md` (may be dated).

## The app
- Free beekeeping app ("Completely Free", no paid tier). Most users use the **website** or the
  installed web app; the Google Play app is only on **Closed testing** (production access needs
  12 testers for 14 days).
- React + Vite + Tailwind, wrapped by Capacitor 8 for Android. Supabase for data and file
  storage. Server functions in `api/` run on Vercel.
- Code: github.com/ronaldnolte/beekeeper. `develop` → test.beektools.com; `main` →
  beekeeper.beektools.com. Vercel deploys automatically on push.
- AI: Google **Gemini 2.5 Flash** through `@google/generative-ai` (an older Google package;
  moving to `@google/genai` is a sensible clean-up). Key name `GOOGLE_GENERATIVE_AI_API_KEY`.
  Only one key is in use: AI Studio project "Beektools AI Implementation", key
  **"Gemini API Key 2" (ends Ae2A)**, paid tier ("Tier 1 · Postpay", billing "AI for Beektools").
  The same key is set in Vercel for both sites. The two unused keys were deleted 2026-10-18.

## Gotchas that cost time before
- **Server functions that write to the database must be called on the same site the page came
  from** (`/api/...`), not the hard-coded live address — otherwise the test site sends a test
  sign-in to the live function and the write fails. Only the phone app (no own server) uses
  `https://beekeeper.beektools.com/api/...`. Decide with `Capacitor.isNativePlatform()`.
- `inspections.id` is **text**, not a number. `inspections.queen_status` must not be empty;
  "unknown" means "not recorded".
- An open page on the phone keeps running the old version after a deploy — reload it.
- Vercel gives every deploy its own long address; use test.beektools.com instead.
- Samsung's camera ignores the app's "use the back camera" request: switching to the back lens
  once **in Samsung's own Camera app** fixes it (there's no default-camera setting).
- Inspection photos and voice notes in Supabase Storage have **no backup** at all (the database
  itself has daily backups on Supabase Pro). Known open risk.

## Current work: Hands-free inspection (on `develop` only, NOT on the live site)
A second button "Hands-free Inspection" under "+ Add Inspection". Code in
`src/features/inspection/handsfree/`, plus `api/summarize-inspection.ts`,
`src/data/inspectionSummary.ts`, `src/shared/device/keepAwake.ts`. Start-over point: git tag
`before-talk-through`.

How it works:
1. **Ready check** (about 10 seconds): microphone + sound bar, a real "testing one two three"
   sent through transcription, keep-screen-awake, signed in. After one clean pass on a device,
   later runs are silent unless something fails.
2. **Dictation**: talk continuously; audio is saved and transcribed in one-minute pieces as voice
   notes. Quiet minutes are skipped. Tapping **Photo** ends the current part (take turns:
   dictate → photo + caption → Continue dictation). Screen stays awake the whole inspection
   (never times out while dictating; lets go after 30 minutes with no touch between recordings).
3. **Finish**: waits for the last text, asks Gemini for a summary, "By location" notes (bar N /
   box N frame M — Langstroth boxes counted from the bottom), "To do" items, and suggested
   queen/brood/temperament/honey/pollen answers. Notes = summary + full dictation. The form shows
   suggestions tagged "✨ AI suggested" with "You said: …"; unmentioned answers stay
   "Not recorded". Ron confirms with Save & Exit. Edited Notes aren't replaced without asking.

Fixes along the way (all on `develop`): transcription told to ignore hive noise; automatic
retries; server allowed 60 seconds; **the transcription server step now saves the text before
deleting the audio** (the old order lost a minute once). That last fix is **also needed on the
live site** — Ron decided it ships later together with Hands-free, after his testing.

**Ron's latest test status (2026-10-19):** dictation, photos, captions, Finish and the summary
work on his phone (Samsung S24+, Chrome).

**Next steps (in order):**
1. Ron's realistic test: full inspection dictation; check summary, locations, to-dos and
   suggested answers for mistakes or invented details. Also: a 2-minute silence test, a 30-photo
   PDF test (photo limit is now 30), and a Langstroth hive test.
2. New PDF layout: summary, to-dos, location notes, form answers, photos with captions, full
   dictation (`exportInspectionPdf.ts` already builds a PDF; "unknown" prints "Not recorded").
3. Optional: in-app camera (always back camera; dictation could continue during photos).
4. Google Play app testing only when just minor changes remain: needs a phone build pointed at
   the test site and test database (not built yet) — never test new saving code in a phone build
   aimed at the live database.
5. When Ron approves: request from `develop` to `main` (he merges), then a phone build.

Known small gaps: browser Back from the form goes back into Hands-free; if a minute fails and is
recovered later in Photos & Voice, Notes don't update by themselves.

## Phone app (Google Play) build — from `main` only
1. On `develop`: bump `versionCode` and `versionName` in `android/app/build.gradle` and
   `version` in `package.json` (never reuse a number). Merge to `main` (Ron).
2. `git checkout main && git pull`, then run `build-local-aab.ps1` (web build → Capacitor sync →
   signed bundle). Needs `JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"`.
3. Output: `android/app/build/outputs/bundle/release/app-release.aab`. Ron uploads it.
4. Signing key + `android/keystore.properties` are deliberately NOT in this folder; they're in
   Ron's original Claude folder. Copy them in only when a release build is actually needed.
- Last built: 86 / 1.5.35 (2026-10-09, from main 3800ff3), waiting for Ron to upload.
- A website deploy does not update the installed phone app.

## Other open items (Ron's priority order, as of 2026-10-09)
1. Data safety: back up photos/voice notes; prove a database restore; `beta_signups` readable by
   anyone; account self-deletion (Google Play requires it).
2. Bugs: apiary with both zip and coordinates silently uses the coordinates; editing an older hive
   rewrites its type to Langstroth; dates off by a day in a few places.
3. Speed: nectar index about 30 seconds per apiary (needs per-location caching).
4. Profile preferences are stored but not used yet (except the analytics opt-out).
5. Google Play: recruit testers (12 for 14 days) to unlock public release.
- Nectar index details and reasoning live in `E:\claude\NectarV2\` (RESUME_HERE.md first) —
  outside this folder; ask Ron if needed. Nectar heat gate on `develop` is 32°F base / 800.
