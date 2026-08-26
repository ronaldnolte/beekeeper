# Nectar Potential — open questions

Parked 2026-08-26 at Ron's request; he wants to clarify some things first.
Do not decide either of these without him.

## 1. The inset box on the Nectar Potential chart

It currently shows NFI, Rate, Warmth and Fall — all satellite-index values. None of them
describe the purple curve, so on that view the box is wrong rather than merely misplaced.

Options put to him: replace with potential's own numbers (today's value, distance from
normal, how many plants are open); hide it on that view; or just relocate it and keep the
satellite figures.

## 2. Which adjustment to build first

Nectar Potential has NO moisture or weather correction yet — flowers being open is the
entire story. Ron: "Just having flowers won't produce nectar."

Candidates, in the order they were presented:

- **Soil moisture** — Open-Meteo publishes it by depth. Most direct answer to
  flowers-without-water, and better than rainfall because it integrates over time instead
  of spiking on one storm.
- **Dewpoint** — nectar evaporates from the flower in dry air, so even a watered plant
  yields less. Already proven in the V2 fall term: it is the whole difference between the
  2023 and 2025 chamisa.
- **Heat shutdown** — most species stop secreting above roughly 95F regardless of soil
  water. Cheap; the temperatures are already fetched.
- **Late freeze** — a hard frost after bud break ends that plant's bloom for the year.
  Currently invisible: fruit trees and willow would still draw a full curve after one.
- **Satellite cross-check** — use the existing index to catch what a calendar cannot know:
  the alfalfa was cut, the pasture was grazed, the ground never greened up.
- **Foraging weather** — days too wet, cold or windy to fly. Affects what the colony
  captures rather than what the landscape produces, so arguably a separate number.

## State when parked

Working and on `develop` at `53f9919`. Ron on seeing the curve: "This chart actually makes
some sense again, and it likely represents close to the actual flow structure."

Known and accepted shortfall, recorded as a test in `api/__tests__/bloom-engine.test.ts`:
with the positional decay removed, a diverse June scores about 2.8x a single-dominant-flow
September where Ron reports 1.5x. The intended fix is honest per-zone significance ratings,
not another transform. Re-measure once ratings land.

Also outstanding: published sources rate alfalfa, both clovers and willow all "major" and
do not cover chamisa, Russian olive or salt cedar at all, so the ratings that set curve
HEIGHT remain the weakest input. Curve SHAPE is far more trustworthy than height.
