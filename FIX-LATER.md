# Fix after the first release

The first rebuilt release copies today's app exactly (Ron, 2026-09-25). These are known
oddities to fix one at a time afterwards, each as its own small change.

## Found during the rebuild

- **Nectar "next pass" can show a past date** (Ron, 2026-09-27). The projection counts from
  the last pass Earth Engine has catalogued (FORMULAS §3.14), and passes reach the catalogue
  hours to days late — so "next pass" can be today or earlier. Suggested fix: roll the date
  forward by the pass interval until it is after today (server side; response shape unchanged).

## Copied on purpose (from 07-QUESTIONS-FOR-RON #7)

- Hive status badge always says "Active" (no status column); "Update Status" screen unreachable.
- Hive form shows an "Installation Date" that is never saved.
- Forecast guide says a failed safety check scores 0; the grid still shows the points.
- "Set New Password" hint says "Min 6 characters" (rule is 8).
- Sign-in subtitle still says "Manage your top-bar hives with ease."
- Ask AI says it knows your current weather (it doesn't); example bubbles don't respond to taps.
- Nectar badge can say "Trending Up" next to "falling" (5-day vs 11-day slope).
- Nectar weekly-values dates can show a day early west of London.
- Task due dates show a day early west of London.
- After about 5–6 pm in the US, a new inspection, intervention or mite test defaults to
  tomorrow's date.
- Varroa season chart mixes tests from every year into the same months.
- Feedback: the message is saved even when the email fails, but the screen says it failed.
- Saving an apiary or hive reloads the whole page.
- Nectar error text "This apiary coordinates are missing."
- Dashboard ignores the name saved on Profile.
- Web-app screenshots listed in the install manifest point at the wrong folder.

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
