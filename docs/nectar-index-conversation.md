# Nectar Index troubleshooting, Oct 21, 2026

**Ron:** In my nectar index calculation it is still trending up, but it is October 21st. I think it is due to the unusual amount of rain we have had. But I don't believe there is a large amount of nectar in the environment. Any ideas how to correct the formula?

**Claude:** Rain is greening up everything (grass, weeds, lawns), which NDVI/NDRE read as "nectar," but green isn't flowering. The fix is to make the index respond to phenology, not just greenness.

1. Seasonal gate (cheapest fix). Multiply the index by a bloom-window factor that goes to ~0 after the first hard freeze and tapers after chamisa/sunflower bloom ends. A bell curve over day-of-year fits your preference for probability over hard thresholds.
2. Use the land-cover weight properly. Restrict NDVI/NDRE contribution to forage-bearing cover (shrubland, riparian, orchards/ornamentals) and down-weight grassland and cropland.
3. Replace raw NDVI with its change (slope or deviation from the 5-year average). A sustained late-season rise should reduce confidence rather than raise the score.
4. Cap the precipitation term. Use a saturating function and a lagged window (3-6 weeks), not current rainfall.
5. GDD saturation. After the end-of-season accumulation, hold that term flat or fade it out.
6. Confidence flag. When the index rises outside the expected bloom window, mark it "greenness-driven, low nectar confidence."

If you want just one change, do #1 plus #4.

---

**Ron:** Is the GDD going down?

**Claude:** Not if it's cumulative: GDD only accumulates within a year, so it can only rise or stay flat. If your index shows it falling, it's probably a trailing window, a deviation from the 5-year average, or normalized to a seasonal expectation. Which form does your formula use?

---

**Ron:** Can you look at the code?

**Claude:** (Cloned ronaldnolte/beekeeper, read-only, and read api/_nectar-v2-engine.ts.)

GDD: it does go down. It's a trailing 30-day sum (base 32F, fully open at 800), not cumulative, so it falls as nights cool. That corrects my earlier answer.

What's likely pushing the index up in October:

1. Fall term uses dewpoint as a stand-in for nectar: fallTerm = photoperiod x dewpoint moisture x (1 - |rate|), weighted 0.7. Wet weather pushes the moisture factor to 1.
2. Rate core reads any green-up as a flow. It measures 24-day greening velocity, normalized to the site's own 95th percentile. Rain-driven grass and weed green-up has the same signature as a real flow.
3. The NDWI moisture multiplier removes its penalty when wet, so it doesn't brake anything.

Proposed fixes: killing-frost gate, photoperiod taper, lagged moisture in the fall term, damping the rate core late in the season.

---

**Ron:** We haven't had a freeze.

**Claude:** Then the frost gate wouldn't change anything today. It's only a backstop. The fixes that act now are the photoperiod taper, lagged moisture in the fall term, and optionally damping the rate core after the photoperiod peak.

---

**Ron:** (Screenshot of the app: Nectar Index 87, Trend -0.2%, Greening rate 100%, Warmth 100%; components Greenness 28%, Moisture 96%, Rate (core) 100%, Fall term 0%, Warmth 100%.) When I look at the information I see that code and warmth are still at 100% does that make sense?

**Claude:**
Warmth 100%: the ramp runs from 38F to 58F on the 14-day mean temperature, so 100% means the last two weeks averaged 58F or more. 58F is a low ceiling, so warmth pins at 100% on any mild stretch. Raising dormHi to ~68F would give it room to vary.

Rate (core) 100%: greenness is only 28%, so the vegetation level is low, but the rate is greening velocity over 24 days scaled to the site's own 95th percentile, then capped at 1. A fast rise from a low base after the rain saturates it. Fix: require the greenness level to support the rate, e.g. rate x vigor^0.5.

---

**Ron:** Yes. Is there an online resource where we could check the last 2 weeks of weather?

**Claude:** NWS Albuquerque climate data (weather.gov/wrh/climate?wfo=abq), Weather Underground history (wunderground.com/history), and Open-Meteo (open-meteo.com), which your app uses.

---

**Ron:** Please (look it up).

**Claude:** I could only get 7 days from Weather Underground (Oct 15-21). The 7-day mean was about 56F, roughly 0.90 on the warmth ramp. The lowest low was 38F, so no freeze. The weather feed is fine; the formula is the weak point.

Source: https://www.wunderground.com/history/weekly/us/nm/albuquerque

---

**Ron:** What is the url

**Claude:** https://www.wunderground.com/history/weekly/us/nm/albuquerque (opens on the current week; use the date picker for earlier dates).

---

**Ron:** (Screenshot of Weather Underground daily observations, Oct 1-21, 2026: highs 56-81F, lows 38-60F, dew points 12-54F.)

**Claude:** The 14-day mean (Oct 8-21) works out to about 61.5F, above the 58F ceiling, so warmth 100% is correct.

- GDD gate is probably fully open: about 650 GDD above 32F in the last 21 days alone, plus more earlier in the 30-day window.
- Fall term 0% makes sense: dewpoints were low Oct 14-17 (lows of 12-18F), dragging the 18-day dewpoint average below the 45F threshold. So the fall term is not what's inflating the index; the rate core is.
- No freeze: lowest low was 38F on Oct 17.

The weather inputs are correct; the formula is the weak point.

---

**Ron:** So are we tapering the GDD using the photoperiod as a factor?

**Claude:** No, GDD stays as it is. The taper is a separate multiplier:

index = (rate x levelFactor + 0.7 x fall) x warmth x GDD gate x photoperiod taper x moisture

GDD asks whether heat is arriving (it is). The taper asks whether the plants are still in a nectar-producing season (shorter days say no). Folding it into GDD would break the spring behavior. The fall term already has its own photoperiod bell, so leave that alone. Cutoffs would be set by re-scoring against ground-truth seasons.

---

**Ron:** Can you relist all of your recommendations by highest to lowest

**Claude:**

1. Rate x greenness-level factor (e.g. rate x vigor^0.5). Targets the root cause: rain green-up from a low base saturates the rate at 100% while greenness is only 28%.
2. Photoperiod taper on the whole index. Fades the index as days shorten, independent of rain or temperature.
3. Raise the warmth ceiling (dormHi 58F to ~68F). Stops warmth pinning at 100%, but affects spring, so it needs careful re-scoring.
4. Lagged moisture in the fall term (prior 4-8 weeks). No effect today (fall term is 0%) but prevents wet autumns from inflating the index in future years.
5. Late-season damping of the rate core. Overlaps with #2; optional.
6. Killing-frost gate (zero the index after a day at or below ~28F). No effect until your first freeze; a backstop.

All would be re-scored against the ground-truth seasons (api/__tests__/ground-truth.test.ts) so the spring flow and the September chamisa flow aren't clipped. Suggested plan: do #1 and #2 first, then add the rest one at a time.
