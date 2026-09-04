# Production vs develop — what actually changed, and what the evidence says

Written 2026-08-26 for one decision: Ron is considering going back to the production
version and closing gaps from there. This is the inventory that decision needs.

Nothing in this session has touched `main`. Production is exactly as it was.

## The thing that started it

Ron: *"despite all of our hard work I believe the current version in production more
accurately is describing what I and my fellow beekeepers experienced."*

His account of 2026 at South Valley:
- Flow started early, March and April. Beekeeper meetings discussed it; swarm prevention
  started early.
- Summer was definitely a dearth.
- The May spike was not noticeable at his yard — but he was away, so it "may have been
  high and short".
- Now, late August, the index is rising after several monsoon showers. Late, but real.

Production showed **NFI 10, Flow Starting, rising**. Develop showed **NFI 3, Dearth**.

## What explains that gap — measured, not guessed

**The phase label is a production bug.** Run both engines on identical data and production
reports `FLOW_STARTING` at index 2 with a slope of **-0.00183** — falling, and still called
a starting flow. That is dwell hysteresis holding a stale label while the instantaneous
phase oscillates near zero, the same defect that once displayed "Flow Ending: watch for
robbing" at NFI 1. Develop's reordered classifier (dearth floor checked FIRST) fixes it.

**The number is a develop bug.** Develop added a 20% coverage floor that production does
not have. Monsoon means cloud, so every recent scene is partly obscured:

```
2026-08-20   ndvi 0.249   coverage 16%   <- discarded by develop
2026-08-23   ndvi 0.143   coverage  2%   <- discarded by develop
2026-08-25   ndvi 0.247   coverage 16%   <- discarded by develop
```

Those are the ONLY scenes after 18 August, so **develop is frozen eight days stale and
structurally cannot see the monsoon response.** Measured at South Valley, five years to
2026-08-26:

| coverage floor | scenes | latest scene | index | 14-day rise |
|---|---|---|---|---|
| 20% (develop today) | 594 | 2026-08-18 | 3 | +2 |
| 10% | 670 | 2026-08-25 | 7 | **+6** |
| 5% | 696 | 2026-08-25 | 7 | +6 |
| 0% (production behaviour) | 745 | 2026-08-25 | 4 | +3 |

Note 0% scores WORSE than 10% — the 2% scene on 23 August is junk. Production gets the
monsoon rise by having no filter at all, which will bite it another time. It is
accidentally right here, not right.

The filter is also partly redundant: the engine already weights every observation by its
coverage, so a 16% scene contributes at 16%. **Recommended fix: lower the floor to 10%.**
Not applied — Ron's call, and he sees the hive this week.

## Develop's satellite changes, scored on Ron's own account

Same engine, two fetches, 2026 monthly:

```
                 Mar  Apr  May  Jun  Jul  Aug
production fetch  14   67   25   35    0    1
develop fetch     11   76   42    2    0    1
```

| Ron's account | production | develop | verdict |
|---|---|---|---|
| "Summer was definitely a dearth" | 12 | **1** | develop much better |
| "March-April flow, started early" | 67 | **76** | develop slightly better |
| "May spike not noticeable" | **25** | 42 | production better, but Ron was away |

Develop wins on the claim Ron stated most confidently.

## Inventory: every develop change, with a verdict

**Keep — evidence supports these**
- Dearth-floor-first classifier. Fixes production labelling a falling index of 2 as
  "Flow Starting".
- UTC `dayOfYear`. The local-time version drifted a day across daylight saving and was
  environment-dependent: Vercel runs UTC, a developer machine does not. Also lifted Tijeras
  phase switches from 15/yr to 10 (target <=12).
- Spike rejection. Consecutive passes over unchanged Tennessee landscape inside ten days
  read 0.658 / 0.724 / 0.671 / 0.600 / 0.743 / 0.616.
- Trailing slope at the live end. The centred fit extrapolated to -0.18062 where the
  historical maximum is 0.13434.
- Leap-day pairing on month-day. Day-of-year put 1 Mar 2024 with 2 Mar 2023.
- Ground-truth tests moved into `npm run test` with checked-in fixtures.
- Single sine growing degree days.

**Fix — develop made these worse**
- 20% coverage floor. Blinds the index during monsoon. Lower to 10%.

**Unproven either way — no evidence yet**
- Forage weighting by land cover. Built because South Valley's disc is 52% built-up and
  the plain mean tracked rooftops. Never scored against ground truth on its own.
- Strict vegetation-only cloud mask. Drops 26% of scenes (538 -> 396).
- 60 m sampling instead of 20 m. Chosen for speed (41s -> 19s), NDVI differing by a mean of
  0.0037 on clear days. But each pixel is 9x larger, so a partly-clouded scene loses
  proportionally more usable pixels — this feeds the coverage problem directly.
- Five-year baseline instead of three.

## If going back to production is the decision

What production LACKS that develop has, and would need re-adding:
- The classifier fix (else "Flow Starting" at a falling index of 2)
- UTC date handling (else normals bucket on the wrong day for ten months a year)
- Spike rejection and the live-end slope estimator
- Everything plant-driven: bloom engine, Nectar Potential, thresholds table, combined index

What production has that develop lacks:
- Sight of partly-clouded scenes, which right now is the difference between seeing the
  monsoon and not

The 20% floor is one constant. Reverting the whole hardening to recover the monsoon
response would also discard the fixes above, several of which have measured evidence
behind them. Worth weighing that before a full revert.

## State

`develop` @ 79ad83d and later, all pushed. 95 tests. Production `main` untouched at dd5d897.

Migrations 0008, 0009, 0010 applied to Beekeeper Dev v2. Production has NONE of them.

Open, unresolved, in `NECTAR_POTENTIAL_OPEN_QUESTIONS.md`:
- Which adjustment to build (soil moisture, heat shutdown, freeze, foraging weather)
- Plant significance ratings are unsourced; published references rate alfalfa, both clovers
  and willow all "major" and do not cover chamisa, Russian olive or salt cedar
- June reads 2.8x September where Ron reports 1.5x
- The April hole: 31 days near zero at South Valley, needs a beekeeper not research
- Bloom windows are presence, not yield. White clover runs to 15 September.

## Deferred: a visual consistency pass

Ron, 2026-08-27: *"I think there is a decorative consistency that we have lost along the
way. Perhaps we can have a lipstick on a pig moment when we get everything to work."*

Agreed, and it is mostly from adding UI piecemeal during the index work. Known drift:

- **Three card treatments on one screen.** The chart-source tabs, the satellite-floor
  control and the readout strip each chose their own radius and border rather than the
  app's established `rounded-3xl` / `#2b2b4d` card.
- **Colours outside the phase palette.** Purple for Nectar Potential, amber for Combined.
  Chosen to be distinguishable from each other, not to belong to the app.
- **Two reds for Dearth.** The banner is `#C0392B` for contrast, the chart line is
  `#E74C3C`. Deliberate, but it reads as inconsistent unless you know why.
- **The floor control** is a bare select and button, styled like nothing else.
- **Spacing above the chart** was not rebalanced after the load-timing bar was removed.

Do this AFTER the index settles. Several of these elements are scaffolding for the build
(the three tabs, the floor control) and should not ship at all, so polishing them now would
be work spent on things due to be deleted.

**The apiary selector is the clearest example** (Ron, 2026-08-27). The same list of yards
appears twice in two different visual languages: the Apiaries screen uses light cream cards
with orange pin icons and a chevron; the Nectar Flow selector uses dark navy pills with
centred bold text. Neither is wrong on its own, but they are plainly not the same app.

They are also **not sorted**. Both show South Valley, Desert Hives, Murfreesboro — insertion
order. Alphabetical would put Desert Hives first. That is a behaviour bug, not decoration,
and worth fixing whenever either list is next touched.
