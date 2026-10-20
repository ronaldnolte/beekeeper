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
- **Nectar Flow Local Dev Fix:** Moved seasonal calculation helpers to `src/shared/season.ts` so the local dev server serves them as client code without proxy interference. Updated dev proxy for `/api/nectar-index-v2` to forward to `test.beektools.com`. Added `ViewErrorBoundary` in `App.tsx` to prevent failed screen loads from crashing the entire app shell.

### Next Steps (In Priority Order)
1. **Realistic Field Test:** Full dictation run on mobile to verify summary accuracy, 2-minute silence handling, and 30-photo limit.
2. **PDF Report Update:** Update `exportInspectionPdf.ts` to include the AI summary, location notes, to-dos, and hands-free data in exported inspection reports.
3. **Optional In-App Camera:** Custom camera view allowing photo capture without interrupting active dictation.
4. **Merge & Release:** Pull request from `develop` to `main` (merged by Ron), followed by Android release build from `main`.
