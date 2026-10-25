# Beekeeper — Gemini Agent Guide

Read `AGENTS.md` and `HANDOVER.md` before doing anything, and follow `AGENTS.md` exactly.

---

## ⚠️ Mandatory Rule: Keep This File Updated
**Always update this `GEMINI.md` file after completing a task or milestone.**
Whenever code is finished, tested, or prioritized:
1. Update the **Active Task Progress** section below with the latest status and completed work.
2. Update the **Next Steps** list so the next session knows exactly where to pick up.

---

## Architecture Overview

### Frontend
- **Framework:** React with TypeScript, built using Vite.
- **Styling:** Tailwind CSS.
- **Mobile Wrapper:** Capacitor 8 for Android.
- **Local Dev Server:** Runs via `npm run dev` (http://localhost:5173).

### Backend & Storage
- **Database & Auth:** Supabase (PostgreSQL, Supabase Auth).
- **File Storage:** Supabase Storage (stores inspection photos and voice recordings).
- **Server Functions:** Vercel serverless functions in the `api/` directory (TypeScript).
  - *Note:* In the web app, calls must use relative `/api/...` so requests hit the matching environment.

### AI Integration
- **Model:** Google Gemini Flash via `@google/generative-ai`.
- **Key:** Configured in Vercel environment as `GOOGLE_GENERATIVE_AI_API_KEY`.
- **Capabilities:** Voice note audio transcription, inspection summarization, frame/bar location parsing, to-do extraction, and form field suggestions.

### Versioning Convention
- **Rule:** Increment the build number on every new push/deploy to `develop`.
- **Display:** Rendered in `AppHeader.tsx` right before the account icon, and in `SettingsView.tsx` under About.

### Environments
| Environment | Code Branch | Website | Database |
|---|---|---|---|
| **Test** | `develop` | test.beektools.com | **Beekeeper Dev v2** |
| **Live** | `main` | beekeeper.beektools.com | **Beekeeper** |

*Hard rule:* All development work happens strictly on `develop` and targets the test database. Never commit directly to `main` or touch the live database.

---

## Active Task Progress: Hands-Free Inspection

**Location:** `src/features/inspection/handsfree/`, `api/summarize-inspection.ts`, `src/data/inspectionSummary.ts`, `src/shared/device/keepAwake.ts`.

### Completed Features
- **Ready Check:** Tests microphone, audio transcription round-trip, screen wake lock, and sign-in before starting.
- **Continuous Dictation:** Audio recorded and transcribed in 1-minute chunks as voice notes. Hive noise filtering and automatic retries in place. Audio text is saved before deleting the recording.
- **Photos with Captions:** Pauses dictation cleanly, captures photo with optional caption, then resumes dictation.
- **Gemini Finish Summary:** Generates overall summary, "By location" frame/bar notes, "To do" items, and suggests form answers (queen, brood, temperament, honey, pollen) with user-said quotes.
- **Camera Workaround:** Documented workaround for Samsung phones (toggle to back camera once in Samsung's native Camera app).

### Recent Fixes
- **Nectar Chart Manual Refresh Persistence (AG2610.03, 2026-10-21):** When hitting the recycle button, `NectarFlowV2View` now stores the updated query key in `localStorage` (`nectar_fresh_<apiaryId>`), prefixed with the app version (`__APP_VERSION__`, formerly an AG_VERSION badge, removed 2026-10-24) and today's date. Navigating away and back now serves the fresh recalculated chart from browser cache instead of falling back to the stale pre-refresh cache.
- **Nectar late-season correction (AG2610.02, 2026-10-21):** Wet autumn made the index read 87 on Oct 21 (rate pinned at 100%, greenness 28%). In `api/_nectar-v2-engine.ts`, a "lateness" value (0 until falling day length drops below 11.7h, 1 at 10.6h) now (a) requires greenness level behind the rate core (`rateVigorExp` 0.5) and (b) tapers the whole index down to 10% (`taperFloor`). Spring and September chamisa are unchanged (ground-truth 11/11 pass, tests in `api/__tests__/late-season.test.ts`). **Not yet verified on live October 2026 data** (test fixtures end Aug 20) — Ron to check on test.beektools.com. Untried ideas from `docs/nectar-index-conversation.md`: raise warmth ceiling, lagged moisture in fall term, frost gate.
- **Nectar Flow Local Dev Fix:** Moved seasonal calculation helpers to `src/shared/season.ts` so the local dev server serves them as client code without proxy interference. Updated dev proxy for `/api/nectar-index-v2` to forward to `test.beektools.com`. Added `ViewErrorBoundary` in `App.tsx` to prevent failed screen loads from crashing the entire app shell.

### Next Steps (In Priority Order)
1. **Realistic Field Test:** Full dictation run on mobile to verify summary accuracy, 2-minute silence handling, and 30-photo limit.
2. **PDF Report Update:** Update `exportInspectionPdf.ts` to include the AI summary, location notes, to-dos, and hands-free data in exported inspection reports.
3. **Optional In-App Camera:** Custom camera view allowing photo capture without interrupting active dictation.
4. **Merge & Release:** Pull request from `develop` to `main` (merged by Ron), followed by Android release build from `main`.
