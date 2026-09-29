# Fix after the first release

The first rebuilt release copies today's app exactly (Ron, 2026-09-25). These are known
oddities to fix one at a time afterwards, each as its own small change.

## Still to fix

- Hive status badge always says "Active" (no status column); "Update Status" screen unreachable.
  Needs a new `hives.status` column on the live database — its own small project.
- Hive form shows an "Installation Date" that is never saved. The hives table has no column
  for it (only the automatic created_at). Ron (2026-09-29): save it if a field exists — it
  does not, so this waits for a database change (could go with the status column).
- Saving an apiary or hive reloads the whole page (works; fixing touches the navigation data).

## Already changed on purpose in the rebuild

1. Hive type is only rewritten when the user taps a type button (Ron, 2026-09-25).
2. Nectar number box sits above the main chart instead of hiding its top (Ron, 2026-09-27).
3. Readout strip keeps one height and the page reserves scrollbar space, so hovering the
   chart no longer shifts the page sideways (Ron, 2026-09-27).
4. Photos & Voice bottom bar: the buttons share the width so they fit on a phone instead of
   running off the edge (2026-09-27).
5. Selected task-sheet buttons (Pending/Completed, Low/Medium/High) and the varroa "Above Limit"
   chip use white text instead of amber on amber, so the label is readable (Ron, 2026-09-28).
6. One edit cue everywhere (Ron, 2026-09-28): every editable list item shows the apiary list's
   pencil square (history items, mite tests, tasks); configuration snapshots show a trash
   square because tapping one deletes it. The hive's Task button and Tasks tab open that hive's
   task list with the Dashboard's "+ New Task" button, instead of a blank new task.
7. The Nectar chart's "today" dot pulse is larger and stronger so it is actually noticeable
   (Ron, 2026-09-28).
8. Task due dates show the day that was picked (the stored UTC day) instead of a day early west
   of London; "overdue" starts the day after the due day. Storage unchanged (Ron, 2026-09-28).
9. "More below" hint (Ron, 2026-09-29): a still round down-arrow appears above the bottom
   bars (and inside slide-up sheets) while more than 40 px of the page is below the screen;
   tapping it scrolls down.
10. Forecast grid shows the hours the sun is up (Ron, 2026-09-29): an hour is kept when, on any
   day shown, it starts after sunrise and before sunset. The live app showed the dark sunrise
   hour ("6am" for 6:59) and hid every hour within an hour of sunset. Scores are unchanged.
11. Nectar on short phones (Ron, 2026-09-29: the nav covered the satellite line): the number
   box's band now comes out of the main chart's height, and when the screen is short the
   difference and season-to-date charts are 16 px shorter each.
12. Voice-note "Edit" starts from the current transcript (Ron, 2026-09-29). This was a rebuild
   bug, not a live-app behaviour: the edit box was filled before the transcript arrived.
13. Record dates (inspections, interventions, mite tests) show and default to the LOCAL day;
   the live app used the UTC day, so a new record after ~5–6 pm US time said tomorrow.
14. Nectar weekly values show their calendar date without shifting a day west of London.
15. Nectar "next pass" is rolled forward by the pass interval until it is after today
   (server; response shape unchanged).
16. Feedback: once the message is saved the screen says it was sent; an email-alert failure
   is only logged (the live app said "Failed to send" for a message it had kept).
17. Set New Password hint says "Min 8 characters" (the rule; the live app said 6).
18. Nectar direction beside a trending phase follows the phase (no "Trending Up" + "falling").
19. Ask AI example questions are tappable and fill the question box.
20. Dashboard greets by the name saved on Profile ("Beekeeper" when none).
21. Mite season chart uses only the last 12 months of tests and requeens.
22. Forecast guide says a failed safety check turns the cell red (it keeps its points); the live
   text claimed points were set to 0.
23. Nectar error reads "This apiary's coordinates are missing. Please edit the apiary first."
24. Ask AI welcome says it knows "your location, the season, and your hive types" (it never
   had the current weather).
25. Install screenshots exist (public/screenshots, from the sign-in page via
   scripts/manifest-screenshots.mjs) and the manifest points at them.
26. Sign-in subtitle: "Manage your bees with ease."
