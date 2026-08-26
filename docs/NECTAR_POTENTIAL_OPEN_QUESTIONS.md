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

## Agreed direction (2026-08-26)

**Order of work, Ron's approval:**
1. Move the ground-truth acceptance tests into the app's own `npm run test`. They currently
   live in the harness, so there is no way to score whether an adjustment helped. That suite
   is what caught the calendar rebuild scoring WORSE than what shipped.
2. Satellite as a modifier on bloom potential. Chosen over soil moisture first because it
   observes what actually happened -- the alfalfa cut, the pasture grazed, the ground never
   greening -- and because it already exists and three beekeepers validated it.
3. Soil moisture after that, if it adds anything past the satellite.

**Why not soil moisture first:** Open-Meteo's figure comes from a reanalysis model that does
not know about irrigation. South Valley sits on irrigated pasture over an aquifer beside
flood-irrigated alfalfa, so in a dry year the model reports parched ground while the crop is
watered and yielding. NDWI measures water actually in the leaf and sees irrigation for what
it is. Soil moisture earns its place later for unirrigated rangeland, and for FORECASTING,
which satellite can never do.

**Ron's long-term direction:** user observations should eventually modify the chart for THEIR
apiary. A published list is only ever a regional prior; the alfalfa farm 1.5 miles from his
hives is a fact about his yard, not about the Rio Grande Floodplain. He does not expect any
index to answer everything -- "that may actually come more in the long term from user input."

## Plant list size

Measured 2025 gaps below 0.45 (about one decent plant at peak):

| Zone | Gap | Days | Low |
|---|---|---|---|
| 22g South Valley | 27 Mar -> 26 Apr | 31 | 0.03 |
| 71i Murfreesboro | 12 -> 28 Mar | 17 | 0.21 |
| 71i Murfreesboro | 8 Jul -> 1 Aug | 25 | 0.39 |
| 23e Tijeras | 17 Apr -> 13 May | 27 | 0.26 |

The Murfreesboro July stretch is almost certainly NOT a hole -- it is the real summer dearth
Ron reported first hand, hives empty and feeding started. The April stretches in both New
Mexico zones are genuine research holes: bees are flying and something is feeding them.

Target 12-15 plants per zone, chosen to fill APRIL specifically rather than ten more of
whatever is easy to research. Candidates for 22g: dandelion, tansymustard, wild plum.

**A research hole and a real dearth look identical from here.** Only a beekeeper standing in
the yard can tell them apart, which is the strongest argument for the observation feature and
for the question being "are your bees bringing anything in right now?" rather than "what is
this plant?"

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
