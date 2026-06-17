# Build Brief — Mentor role + Inspection images

Portable handoff for building two features. Created 2026-06-17. Lives on `develop`.
Pairs with local Claude memory; this file is the version that travels with the repo.

## HARD RULE — do not touch production
- Production = Vercel auto-deploys the **`main`** branch → beekeeper.beektools.com.
  `develop` deploys to **preview**. All work happens on `develop`.
- A GitHub ruleset **`protect-main`** is active: `main` requires a PR merge, blocks
  direct/force pushes. Do not weaken or bypass it.
- Promotion to production is a deliberate, user-initiated PR merge — never proactive.
- The prod Supabase DB is **shared between Beekeeper AND TBH Beekeeper** — schema/RLS
  changes affect BOTH apps. Prove everything on the preview DB first. Always check the
  schema before assuming column names.

## Build order
1. Mentorship relationship + RLS (+ age gate)
2. Shared notes — **DROPPED for v1** (see below)
3. "Changed-apiary" badge in mentor's list
4. Inspection images (web/canvas pipeline)

## Feature 1 — Mentor role (v1 scope)
- **Opt-in mentor directory.** A profile flag to list yourself as a mentor (separate
  from any relationship). Listing is a disclosure — explicit + revocable. Mentor can set
  "unavailable/full" to stop receiving requests.
- **Two-sided handshake.** Mentee browses directory → requests a mentor → mentor approves.
  Relationship activates only on mutual consent.
- **State machine:** `requested → approved → active → ended` (+ `declined`). Either side
  can end. Mentee revoke = **instant blackout**. Mentor sees nothing after revoke, at most
  a "status changed" notice.
- **One mentor per mentee** (uniqueness on mentee side). A mentor has many mentees and also
  manages their own hives.
- **Sharing unit = the apiary.** Mentor gets **read-only** access to the mentee's shared
  apiary and everything in it.
- **No in-app private channel** (deliberately dropped — it was the core youth-safety risk).
  Communication happens offline. The app only makes the match; it does **not** broker
  communication, money, or marketing. Show no contact details — people know each other via
  the bee group.
- **No money, ever.** Some mentors are professionals who charge offline; this feature
  enhances that relationship, it is not a marketplace. No rates/booking/"pro" badge.
- **Minors:** baseline = age **self-attestation gate, hard-block under-13** from mentorship.
  Guardian-consent model held in reserve if youth market is pursued later.

## Feature 2 — Inspection images
- Web/PWA is a first-class client. Upload via `<input type=file accept=image/*>` (offers
  camera on mobile web) + **in-browser canvas compression**. One pipeline for web + PWA +
  native wrapper.
- **Non-negotiable disciplines:** compress to ~200–500 KB, store a thumbnail + full, show
  thumbnails in lists (full-res only on tap), per-inspection cap, retention/downscale policy.
- Cost is NOT a free-tier constraint — project is on **Supabase Pro** (~100 GB storage /
  250 GB egress). Disciplines are for speed + avoiding overages, not survival.
- Native caveats (wrapped builds only): OS-native photo picker per platform; normalize
  HEIC→JPEG + EXIF orientation; web offline capture is weaker (IndexedDB + service worker).
- Possible scope cap: limit images to the bee group — now a community choice, not a budget one.

## Data model sketch (additive — new tables, zero-risk)
- `mentor_profiles` — who is listed as a mentor, availability, bio/region.
- `mentorships` — (mentor_id, mentee_id, apiary_id, status, timestamps); unique active per mentee.
- `inspection_images` — (inspection_id/owner, storage path, thumb path, created_at).
- Apiary gets `last_activity_at`; per-mentor `last_viewed_at` drives the "changed" badge.

## The ONE risky change (test hardest in preview, security-review it)
- A new **SELECT RLS policy on EXISTING tables** (apiaries/hives/inspections) granting a
  mentor read access. This is the only change that alters a live data path.
- Write the visibility test **once** as a Postgres function (e.g. `can_read_apiary(apiary_id)`)
  reused across tables. Mentors get SELECT only — no INSERT/UPDATE policy = read-only.
- Revocation works by flipping the `mentorships.status`; queries then return nothing.

## Operator/admin work needed before images ship
- App becomes a platform operator (users see each other, post content). Need: contact email,
  privacy/terms page naming the operator + describing sharing, and an `is_admin` role with
  moderation actions (remove mentor from directory, force-end relationship, remove an image).

## Promotion path (single controlled event, when ready)
1. Keep schema **additive** (new tables land inert in prod).
2. Validate the RLS-on-existing-tables change exhaustively in preview.
3. Apply to prod via **migration files** (repeatable/reviewable), not dashboard clicks.
4. Promote merged-but-**feature-flagged** code to prod dark; flip the flag for
   self → bee group → wider on your own schedule.

## Open TODOs
- [ ] Verify/test **backup & restore** procedures (Pro = daily backups, 7-day retention;
      PITR is a paid add-on). Confirm backups run, retention is right, and **test an actual
      restore**. Check whether the preview DB has backups.
- [ ] Confirm exactly which Supabase DB the **preview** stack points at (frontend separation
      is clean; DB separation needs confirming, given the shared-DB note).
