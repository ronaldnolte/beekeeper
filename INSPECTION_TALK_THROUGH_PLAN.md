# Talk-Through Inspection — Planning (no code yet)

Written 2026-10-18. Planning only. Nothing in the app has been changed.

Builds on the existing "Inspection Plus" (photos + voice notes) and the
existing PDF report. See `PDF_REPORT_DESIGN.md` for the PDF background.

---

## Decided

- **2026-10-18 — AI stays on Gemini for now.** Ask AI, transcription and the
  new summary + form-filling all use Gemini (the same key already on Vercel).
  Claude remains an option later; the Goal 5 section below is kept for that.
  Gemini can return the form answers in a fixed format (it supports a required
  answer layout), so Goal 4 works the same way on Gemini.

## The short version

1. **Most of this is buildable with what the app already has.** Photos, voice,
   transcription, the PDF maker and the AI connection all exist. The new work is
   (a) one long recording instead of 90-second clips, (b) a "summarize and fill
   the form" step, and (c) a bigger PDF.
2. **The one real risk is talking continuously while taking photos.** Today,
   "Take photo" hands the phone over to the camera app. On many phones (iPhone
   especially) that pauses or kills a recording that the web page started.
   This must be tested on real phones **before** building anything else.
3. **Switching the AI from Gemini to Claude is easy for "Ask AI" and the new
   summary, but not possible for transcription.** Claude cannot listen to
   audio. Recommended split: **Gemini listens (turns speech into text), Claude
   thinks (Ask AI + the inspection summary).**
4. **Raising the photo limit to 30 is a one-number change.** The side effect to
   test is the PDF: 30 photos makes a bigger file and works the phone harder.

---

## Goal-by-goal

### Goal 1 — Talk throughout the inspection, with transcription

**Today:** each voice note is a separate tap-start / tap-stop clip, capped at
90 seconds, recorded in a pop-up that covers the screen. When you tap "Use",
the whole clip is sent to the server, Gemini turns it into text, and the audio
is deleted.

**Proposed:** one big **Start inspection** button. The microphone stays on
until **Finish**. Behind the scenes the app quietly cuts the recording into
pieces of about one minute and sends each piece for transcription as soon as it
is finished. The text appears in a running log on screen, so you can see it is
working. You never have to think about clips.

Why cut it into pieces (rather than one long recording):
- The server only accepts about 4.5 megabytes per request. A 20-minute
  recording sent in one go would go over that.
- If one piece fails (bad signal at the hive), only one minute is at risk, not
  the whole inspection. The failed piece keeps its audio so it can be retried.
- Text shows up during the inspection instead of all at the end.

Each piece is stamped with its time ("minutes 4–5"), and so is each photo. That
lets the AI later connect "this is bar 12, lots of capped honey" to the photo
taken at that moment.

Things that can stop a web-page recording, all to be tested:
- **Taking a photo** (camera app takes over the screen) — see Goal 2.
- **Screen turning off.** Fix: the browser's "keep screen awake" feature while
  an inspection is running.
- **Switching apps / a phone call.** Expected to pause; the app should notice,
  show "Recording paused — tap to resume", and never lose what was already
  captured.

Option ruled out: the browser's built-in live speech-to-text. You already
rejected this in June as unreliable across iPhone / Android / web, and nothing
has changed that.

### Goal 2 — Keep taking photos (with captions) during the inspection

**Today:** "Take photo" opens the phone's own camera app. The photo is shrunk
in the browser (longest side 1600 pixels, saved as WebP), with a small
thumbnail. A caption is a separate voice note tied to the photo.

**The catch:** while the camera app is in front, the web page is in the
background, and the recording can stop. Two ways to handle it:

| Option | How it works | Pros | Cons |
|---|---|---|---|
| **A. Pause and auto-resume** | Keep using the phone's camera app. The recording pauses for the photo and restarts automatically when you come back. | Small change, familiar camera. | Words spoken while the camera is open are lost. Auto-restart may need a tap on iPhone. |
| **B. Camera inside the app** | Show the live camera view inside the inspection screen itself; a shutter button takes the photo. The page never leaves the front, so the microphone keeps running. | Truly continuous talking. Photo, time and words line up perfectly. | More work. No zoom/flash controls from the phone's own camera. |

| **C. Take turns: dictate, photo, dictate (Ron's idea, 2026-10-18 — recommended)** | Tapping the camera **ends** the current dictation part on purpose. Take the photo, add its caption, then tap **Continue dictation**, which starts the next part. | Sidesteps the camera problem entirely: the microphone is never on while the camera is open. Every caption clearly belongs to its photo. Simple to build on what exists today. | Short gap while photographing (by design). |

**How option C looks on screen:**
1. **Dictating** — red "Recording" bar, running text log underneath.
2. Tap **Take photo** — dictation stops by itself and is saved as Part 1.
3. Camera, then the photo appears with **Add caption** (one tap, as today) or skip.
4. Big **Continue dictation** button — starts Part 2. Repeat as often as needed.
5. **Finish** — summary and form suggestions.

**"Continue" or "Part 2, Part 3" — both, because they are the same thing
underneath.** Every stretch of talking is stored as its own numbered part, in
order, with the photos sitting between them. On screen it can read as one
continuous dictation with small markers ("Photo 3 — capped honey, bar 9")
where photos were taken; the part numbers are kept for the AI and the PDF. The
AI then gets a clean timeline: Part 1, Photo 1 + caption, Part 2, Photo 2 …
so "I'm on bar 12 now" said in Part 2 carries forward to the photos after it.

A long part is still cut into one-minute pieces behind the scenes for
transcription (see Goal 1); the beekeeper never sees that.

With option C the phone test gets smaller: it only needs to confirm a long
part survives the screen dimming, and that dictation restarts cleanly after
the camera. Options A and B are kept above only as fallbacks.

**Captions:** with continuous talking, a caption can simply be *what you say
right after the photo* — the AI attaches it. Keep the existing explicit
"Add caption" button as well for anyone who wants it tied down exactly.

### Goal 3 — AI summary when the inspection is finished

A new server step, run when you tap **Finish**. It gets:
- the full transcript, in time order, with the photo moments marked in it,
- photo captions,
- the hive type and layout already stored in the app — for top-bar hives the
  bar count; for Langstroth, the list of boxes (deep / medium / shallow,
  excluder, etc.) and frames per box,
- apiary location and season (the same context Ask AI already uses).

It returns:
- a short written summary,
- a **location-by-location list** — "Bar 7: eggs and young larvae", or
  "Box 2 (deep), frame 4: queen seen" — only where you actually said a location,
- suggested answers for the form (Goal 4),
- anything worth acting on ("queen cells on bar 14 — check again in 5 days").

The AI is told to use only what you said, never to invent bar numbers, and to
say "not mentioned" rather than guess.

Optional extra, decide later: let the AI **look at the photos** too, not just
the captions. Both Gemini and Claude can do this. It costs more per inspection
and is less predictable, so it is a good second step, not part of the first one.

### Goal 4 — AI fills in the form (queen, brood, temperament, honey, pollen)

The AI picks from the **same choices the form already uses** (for example
Queen: Seen / Eggs / Larvae / Capped / Virgin / No queen / Queen cells).

Recommended rule: **the AI suggests, you confirm.** After Finish you see the
form already filled in, with the AI-picked answers highlighted. One tap to
accept, or change any of them. The app never silently overwrites something you
chose yourself.

Watch-out found while reading the code: new inspections start with defaults
already selected (queen "Seen", brood "Good", temperament "Moderate", honey and
pollen "Half"). If the AI says "not mentioned" and the default stays, the record
would claim the queen was seen when nobody said so. Talk-through inspections
need an honest "not recorded" state instead of those defaults.

### Goal 5 — How hard is switching the AI from Gemini to Claude?

The app uses Gemini in exactly **two places**:

| Where | What it does | Can it move to Claude? | Effort |
|---|---|---|---|
| Ask AI (`api/chat.ts`) | Answers beekeeping questions | **Yes** | Small — one file, about half a day including testing |
| Voice transcription (`api/transcribe.ts`) | Turns recorded speech into text | **No** — Claude does not accept audio | — |

What a switch involves for Ask AI:
1. Add Anthropic's official package to the project.
2. Add a Claude key to Vercel for **both** the live site and the test website
   (the same way the Gemini key is set up today).
3. Rewrite the one call in `api/chat.ts`; the questions, location/season context
   and rules stay as they are.
4. Test on the test website, then ship.

For transcription the choices are:
- **Keep Gemini for transcription (recommended).** It works today, it is cheap,
  and it already handles the phone and web recording formats.
- Move transcription to a dedicated speech-to-text service (several exist).
  More accounts and keys, no real benefit right now.

Two housekeeping points either way:
- The Gemini code package the app uses (`@google/generative-ai`) is Google's
  older one; Google has moved to a newer package. If Gemini stays for
  transcription, moving to the newer package is a sensible small clean-up.
- **Installed phone apps call the live site's transcription directly.** Any
  change to how transcription is called must keep working for older phone-app
  versions already installed. New features should be new server steps, not
  changes to the existing one.

Claude model choice (decision for you; prices per million words-ish "tokens",
input / output, from Anthropic's current list):

| Model | Price in / out | Fit |
|---|---|---|
| Claude Haiku 5.5 | $0.10 / $0.50 | Cheapest and fastest; fine for Ask AI, probably fine for summaries |
| Claude Sonnet 5.5 | $2 / $10 | Strong middle ground for the summary + form-filling |
| Claude Opus 5.5 | $4 / $20 | Most capable; likely more than this job needs |

Rough cost of one summary of a 20-minute inspection (about 6,000 tokens in,
1,500 out): Haiku about **one-tenth of a cent**, Sonnet about **3 cents**,
Opus about **5 cents**. Transcribing 20 minutes of audio with Gemini is in the
range of a few cents (Gemini's price to be re-checked before building). Claude
can return the form answers in a guaranteed, fixed format, which makes Goal 4
dependable.

Suggested order: switch Ask AI first, so the summary is built once, on Claude,
"the same as Ask AI".

### Goal 6 — Photo limit from 12 to 30

The limit is a single number in `InspectionAttachmentsView.tsx`
(`PHOTO_CAP = 12`). Effects to check:
- Storage: roughly 10 megabytes per full inspection — no concern on the
  current Supabase plan.
- **The PDF:** 30 photos means a bigger file (estimate 5–10 megabytes) and more
  work for the phone while building it. Test on your phone with 30 photos.
- The limit is only enforced in the app screen, not on the server. Fine for
  now; noted.

### Goal 7 — Summary PDF after the inspection

The PDF maker already exists (`exportInspectionPdf.ts`): logo, date, apiary and
hive, the form answers, photos and voice-note text. Proposed new layout:
1. Header (as today)
2. **AI summary** and **action items**
3. **Bar-by-bar / box-and-frame notes**
4. Form answers
5. Photos with captions and their time in the inspection
6. Full transcript at the end

After Finish and your confirmation, the summary screen shows a **Save PDF**
button. The PDF is still made on the phone, on demand, nothing extra stored on
the server (same decision as June).

To check: in June, saving the PDF worked on the website and installed web app,
but the **Google Play phone app** still needed an extra piece to save files.
Confirm whether that was finished before relying on it here.

### Goal 8 — Evaluation of today's voice and photo technology

**Voice recording** — the browser's built-in recorder (WebM/Opus on Android and
desktop, MP4 on iPhone).
- Good: works on web, iPhone and Android with no extra installs; small files;
  microphone permission asked only when first needed.
- Limits for the new goal: 90-second cap; recording happens in a full-screen
  pop-up that blocks everything else; the clip is sent as one block (size
  limit); nothing keeps the screen awake; no handling of interruptions.
- Verdict: **keep the recorder, rebuild the screen around it** (continuous, in
  pieces, non-blocking).

**Transcription** — Gemini 2.5 Flash, sent the audio with a "write down exactly
what was said" instruction; audio deleted once the text is saved, kept only if
it fails.
- Good: cheap, quick, already proven on the live site.
- Improvement: give it a short beekeeping word list (brood, supersedure,
  propolis, queen cells, foundation, etc.) so it spells beekeeping terms
  correctly.

**Photos** — the phone's own camera via the standard web "take a photo"
control, shrunk in the browser to 1600 pixels WebP plus a thumbnail, kept in a
private storage area only the owner can see.
- Good: simple, reliable, small files, works everywhere.
- Limits for the new goal: leaves the page (interrupts recording, see Goal 2);
  12-photo cap.

---

## Proposed order of work (revised 2026-10-18)

Ground rule: everything on `develop` / test.beektools.com / test database only.
Nothing reaches beekeeper.beektools.com or Google Play until Ron decides the
concept works. Android only for now. AI stays on Gemini.

1. **Keep-screen-awake fix** — Chrome's built-in feature for the website, free
   "keep-awake" add-on for the phone app. No new phone permission.
2. **Phone-app test switch** — a cable-installed phone build that talks to
   test.beektools.com and the test database instead of the live site.
3. **Throwaway phone test page** — saves nothing; long dictation, take a photo,
   continue dictating; shows awake status, timer and part count on screen.
   Test in Chrome and in the phone app on Ron's Android phone.
4. **Photo limit 12 → 30**, and test the PDF with 30 photos.
5. **"Ready check" — first screen of every talk-through inspection** (Ron's
   idea, 2026-10-18). About 10 seconds, before the beekeeper commits:
   - Microphone: permission granted, and a live sound-level bar while they
     say "testing, one two three" (also where the mic permission prompt
     appears, calmly, before the hive is open).
   - Turning speech into text: that test clip is sent and the words come back
     ("We heard: testing one two three") — proves signal, sign-in and the
     transcription service end to end, for a fraction of a cent.
   - Keep screen awake: switched on successfully, or a tip to lengthen the
     screen timeout.
   - Still signed in (an expired sign-in would make every piece fail).
   Results: green = go; amber (e.g. screen-awake refused, weak signal) = can
   continue with a warning; red (no mic, no service) = stop and offer the
   Standard form instead. After the first full check on a device, later
   inspections run it silently and only show it if something fails.
   The throwaway test page in step 3 is the first rough version of this.
6. **Take-turns dictation screen** — dictate, photo + caption, Continue
   dictation (Part 1, 2, 3 …); sent in one-minute pieces for transcription;
   "paused — tap to continue" if interrupted.
7. **Gemini summary + form suggestions** on Finish — bar / box-and-frame notes,
   action items, suggested answers you confirm; honest "not recorded" instead
   of the current defaults. Summary stored on the inspection (test database
   first).
8. **New PDF layout** — summary, action items, location notes, form answers,
   photos with captions, full transcript.
9. **Ron tries it on real inspections** at test.beektools.com, then decides
   whether it goes live.

---

## Where testing happens (checked 2026-10-18)

- **Website / installed web app:** test.beektools.com — develop code, test
  database (Beekeeper Dev v2), and its own transcription step. Fully safe.
- **Google Play app installed by cable:** caution. A phone-app build has its
  server addresses fixed to the **live site** (transcription, Ask AI, etc.),
  and takes its database address from the main settings file at build time,
  normally the live database. So:
  - The throwaway phone test page must **save nothing** (record, show timer,
    "screen awake" status and part count on screen only). Then it is safe in
    both places.
  - Before testing the real feature inside the phone app, add a "test build"
    switch that points the phone app at test.beektools.com and the test
    database. Never test new saving code in a phone build aimed at the live
    database.
- Android only for now (Ron, 2026-10-18); iPhone testing deferred.

## Decisions

Made 2026-10-18: AI stays on Gemini (Ask AI, transcription, summary); camera
handled by taking turns (option C); develop / test site only; Android only;
a ready check opens every talk-through inspection.

Still open:
1. **Where does this live?** Recommended: it *becomes* "Inspection Plus" (Plus
   = talk-through). Standard stays untouched. Alternative: a third choice next
   to Standard and Plus.
2. **Form filling:** AI suggests and you confirm (recommended), or AI fills it
   in directly?
3. **Should the AI look at the photos** in the first version, or only captions
   and talk?
