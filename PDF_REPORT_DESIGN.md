# PDF Inspection Report + Photo Export — Design

Status: **designed, no code yet** (2026-06-30). Architect-role planning session.
Additive feature on top of the existing Inspection Plus attachments work.

## Goals

1. **PDF inspection report** — a single-inspection report the user can save or
   send to a mentor for review. Snapshot of the inspection's questions + answers,
   the photos, and the voice-note transcripts.
2. **Save photos to the device** — let the user export their inspection images so
   they land somewhere they can find (gallery / Files / Downloads).
3. **Data portability** — underlying both: a user is never locked in. If they
   decide to move to another app, they can take their inspections (as PDFs) and
   their photos (as standard JPEGs) with them. Good trust story and a clean
   answer for Google Play / data-export expectations.

Nothing is stored server-side. Everything is generated **on the device, on
demand**, and handed off. No new DB tables, buckets, or server functions.

## Decisions (locked)

- **Single inspection per report.** Users can make one for every inspection if
  they want. (Multi-inspection "season summary" is a possible later addition;
  the template is designed for one inspection now and doesn't block it.)
- **Client-side generation**, not a server function. Matches the "don't save it,
  just let them save/send it" requirement; avoids extra egress + cold starts.
- **Save target = the system share sheet.** Easiest to build and the most
  findable: Android → "Save to Photos"/"Save to Files", iOS → "Save Image". No
  storage permissions. The same sheet covers "send to a mentor" (email/messages)
  *and* "save it." One mechanism for both saving and sharing, PDF and photos.
- **Voice notes = transcript text, not playable audio.** PDFs can't reliably play
  audio in any mobile viewer, and our own flow deletes the audio after a
  successful transcription anyway. Failed-transcription case → print a
  `[voice recording — transcript unavailable]` placeholder.

## PDF layout — mirrors the on-screen experience

The report reads top-to-bottom the way the user built the inspection:
**(1) the filled-in inspection form**, then **(2) the same chat-style feed of
attachments** they scrolled through while adding photos and voice text. It should
feel like a printed copy of the inspection, not a generic data dump.

```
┌─────────────────────────────────────────────┐
│  [logo]   Inspection Report                  │   ← header
│           June 28, 2026                       │
│           Apiary: Back Field · Hive: Hive 3   │
├─────────────────────────────────────────────┤
│  THE FORM (selected answers, form's order):  │   ← section 1: the form itself
│  Queen status: Eggs                           │
│  Brood pattern: Good                          │
│  Temperament: Calm                            │
│  Honey stores: Half     Pollen stores: Full   │
│  Observations: <text / voice transcript>      │
├─────────────────────────────────────────────┤
│  THE FEED (attachment order, top→bottom):    │   ← section 2: the scroll feed
│   ┌───────────────────────┐                   │
│   │      large image      │   ~120–150mm wide │
│   └───────────────────────┘                   │
│   caption: "<transcript>"                     │
│                                               │
│   ┌───────────────────────┐                   │
│   │      large image      │                   │
│   └───────────────────────┘                   │
│   caption: "..."                              │
│                                               │
│   voice note: "<standalone transcript text>"  │
│   ... flows across pages ...                  │
└─────────────────────────────────────────────┘
```

- **Section 1 = the form itself.** Same fields in the same order the form
  presents them, rendered as the *selected* answer (label from
  `inspectionOptions.ts`), plus observations + date/weather. Looks like a
  filled-in copy of the form, not a table.
- **Section 2 = the feed, in screen order** (`sort_order` then `created_at`).
  Each photo is followed by its caption transcript inline; standalone voice notes
  appear as their transcript text. Same top-to-bottom order the user saw.
- **Image size:** inline in the feed at **~120–150 mm wide** (roughly the text
  column) — significantly larger than the on-screen thumbnail so comb/brood
  detail is legible, but **NOT** one-image-per-page. Two–three photos per page as
  the feed flows. Keep a photo and its caption together across page breaks.
- **Full resolution** is intentionally NOT the goal here — anyone who wants the
  original taps "Save photo" (the separate export). The PDF is for review/sharing.

Data sources (all already available, no new queries):
- Logo: `public/logo.png` (PNG embeds directly in jsPDF).
- Inspection fields: the `inspections` row + labels from
  `src/features/inspection/inspectionOptions.ts`.
- Hive + apiary names: already in app state (`useAppStore`); the inspection row
  only carries `hive_id`, but the names are loaded when viewing it.
- Photos / captions / voice notes: `inspection_attachments` via
  `fetchAttachments()` (returns short-lived signed URLs). A caption is a
  voice note with `parent_id` = the photo's id; a standalone note has none.

## Shared utility — WebP → JPEG converter

The single most important shared piece. Photos are stored as **WebP**
(Medium = longest side 1600px / q70). Both features need a **JPEG**:

- **PDF** *requires* it — jsPDF embeds JPEG/PNG reliably, not WebP.
- **Photo export** *wants* it — JPEG opens everywhere; WebP still trips some
  desktop tools, older email clients, and photo viewers. Ease of use for the
  mentor on the receiving end.

Pipeline (canvas is built-in, no dependency):

```
fetch(WebP signed URL) → blob
  → createImageBitmap(blob)
  → draw to <canvas>            (PDF embeds at ~1300–1400px for legible detail;
                                 photo-export keeps the full 1600px)
  → canvas.toDataURL('image/jpeg', ~0.85)
  → JPEG dataURL / blob
```

Build once. PDF feeds the JPEG into the document; photo-export hands the JPEG to
the share sheet.

## Photo-export UX

- **Primary: "Save all photos"** from the inspection — the share sheet accepts
  multiple files in one invocation on Android/iOS; web `navigator.share` accepts
  multiple where supported, per-file `<a download>` fallback otherwise.
- **Secondary: per-photo save** in the lightbox for a single image.

### Export resolution (decided)

Exported images go out at the **stored resolution — longest side 1600px**, the
same as held in the bucket. That is the ceiling: the app only ever keeps the
1600px/q70 compressed version (the original full-size camera photo is discarded
at capture), so there is nothing larger to export and no upscaling is attempted.

The only transformation is **format, not size**: stored WebP → JPEG at the same
pixel dimensions, encoded at **high quality (~0.9)** so the conversion is
visually lossless. Caveats: it's a generational re-encode (WebP→JPEG, not
byte-identical, but visually indistinguishable at q0.9), and JPEG drops
transparency (irrelevant for photos).

This is deliberately distinct from the **PDF**, which embeds images smaller
(~1300–1400px) to stay shareable. The photo-export is the path that hands over
the full stored image; the PDF is for review/sharing.

## Tools to add

| Tool | Purpose | Notes |
|---|---|---|
| `jsPDF` | client-side PDF generation | ~100 KB gzip, **lazy-loaded** on the Export tap — off the startup path |
| `@capacitor/share` | native share sheet (PDF + images) | web falls back to Web Share API / download |
| `@capacitor/filesystem` | write the file to disk before native share | native path only |

Web path needs **zero** new dependencies (Web Share API + `<a download>` +
canvas are all built in). The two Capacitor plugins are purely for the native
Android/iOS share experience. The WebP→JPEG converter is built-in canvas.

No new DB tables, buckets, schema changes, or server functions.

## Overhead

- **Server storage:** zero added — nothing persists. (The point of the design.)
- **Bundle:** ~100 KB gzip jsPDF, lazy-loaded so startup/main bundle unaffected.
- **Egress (Supabase):** generating a report/export re-downloads full images via
  signed URL, ~2–6 MB per export for a 10–12 photo inspection. Negligible vs the
  ~250 GB/mo Pro allowance.
- **Device memory — the only thing to watch:** decoding a dozen 1600px bitmaps
  at once + building a multi-MB PDF can spike memory on low-end Android.
  Mitigation: process images **sequentially** (decode→embed→release one at a
  time) — keeps the peak to roughly one image at a time regardless of count.
  Images are embedded at ~1300–1400px (large enough for legible detail at the
  ~120–150 mm print width, see layout), so a 10–12 photo report lands around
  **3–6 MB** — still trivial to email/message; full-res original stays available
  via "Save photo".
- **Permissions:** none on web. None on native either, because the share sheet
  avoids the Android scoped-storage / MediaStore permission story entirely.

## Open / later

- Multi-inspection "season summary" PDF (template already compatible).
- Whether to also offer the report as the share payload by default vs. a separate
  "Export photos" action (current plan: two distinct actions).
```
