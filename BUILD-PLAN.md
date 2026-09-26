# Beekeeper rebuild — build plan

Session 2 (planning), 2026-09-26. Built only from `E:\claude\beeks-spec`.

## Decisions (Ron, 2026-09-26)

- **Stack approved:** Vite + React + TypeScript; Tailwind; TanStack Query (retries, never
  lose a save); hand-drawn SVG charts; Leaflet; jsPDF (loaded on demand); Supabase JS;
  Vercel functions under `/api` (Node, underscore-named helpers); Vitest (forced UTC);
  Playwright (phone-size screenshots vs `golden/screenshots`); Capacitor 8 for Android.
- Alternatives weighed and rejected: Next.js/Remix/Nuxt/SvelteKit (no gain, need their own
  Vercel config), React Native/Expo and Flutter (second website codebase, can't match web
  screenshots), Svelte/Solid/Vue (smaller ecosystems, modest gain), Supabase Edge Functions /
  Cloudflare (the `/api` addresses must stay; Earth Engine needs Node).
- **Android updates stay as today:** most users are on the website; Ron ships an Android
  build when changes are significant. No live-update service, no Trusted Web Activity.
- Local secrets come from `.env-archive/` (a one-time copy; the old folder stays closed).
  `old.env` = PRODUCTION; never place it in the project root.
- Ron adds branch `rebuild` to the Vercel Preview test-database branch filter before the
  first push. Regardless, a build guard fails any non-`main` build that points at the
  production database (`ayeqrbcvihztxbrxmrth`).
- Satellite fetcher is checked locally with the Earth Engine key, end date pinned to
  2026-09-25, against `golden/nectar-live/`.

## Assumptions (Ron may overrule)

- First rebuilt Android release: version 1.6.0, versionCode 86.
- The unreachable "Update Status" screen is not built.
- Task sheet in edit mode shows the stored UTC calendar day of the due date.
- The golden generator scripts import the old code; they are not run. A new checker
  compares against the saved answer files.
- Sign-in on localhost/Preview for testing is done by Ron in the built-in browser.

## Milestones

Each ends with passing tests, one push to `rebuild` (Preview → Beekeeper Dev v2), and Ron's
check on Preview.

| # | Milestone | Proven by |
|---|---|---|
| 0 | Skeleton, static files, hosting rules, production-database build guard | Preview loads on Beekeeper Dev v2 |
| 1 | Nectar engine (pure module) + chart math, forecast scoring, varroa math, season helpers | 6 fixture runs to 1e-9 every day, phases/NFI exact; synthetic, slope, season, live-key, forecast files exact |
| 2 | Nectar server function (Earth Engine fetch, weather failover, auth, plain-text 401, cache headers) | Local fetch to 2026-09-25 vs `golden/nectar-live` |
| 3 | App shell: sign-in, reset, beta, header, nav, back behaviour, analytics, service worker, What's New | A01–A08, B01 |
| 4 | Nectar Flow screen (charts, details, full screen, review mode) | B05–B12 + golden chart files |
| 5 | Forecast + Ask AI (+ chat function) | B03, B04, B13–B16 |
| 6 | Apiaries, map picker, hives, hive detail, visualisers (+ geocode function) | B17–B25 |
| 7 | Inspections, photos & voice, PDF export, interventions, varroa, tasks, dashboard (+ transcribe) | B02, B26–B38 |
| 8 | Profile, feedback, roadmap (+ feedback, beta, notify-signup functions) | B39–B44 |
| 9 | Full visual audit (54 screenshots) + old-phone-build request shapes | Checklist |
| 10 | Android wrapper; test build on Ron's phone (release build only from `main`, after Ron promotes) | Ron installs it |
