# Advice text rewrite — drafted, approved in part, NOT implemented

Parked 2026-08-27 to get back to the index. Nothing here is in the code.

## The problem

Two separate pieces of advice on the Nectar screen, both switching on PHASE ALONE:

- The one-line banner — `phaseToAdvice()` in `api/nectar-index-v2.ts`
- The Recommended Actions card, three bullets — `getPhaseAdvice()` in `NectarFlowV2View.tsx`

Server-side and client-side, two lists, no shared logic.

Ron, seeing FLOW_STARTING in late August: *"Nectar flow is building. Queen egg-laying is
stimulated. Colony is expanding — watch for swarm preparations."* — **"way off for sure."**
It is spring advice, and the same defect runs through all five phases in both lists.

## The fix

Split on DAY LENGTH, not the calendar: days lengthening means build-up, days shortening
means storing for winter. Same photoperiod logic already driving the fall bloom term, and
it works at any latitude rather than assuming a Northern Hemisphere summer.

Needs one shared helper — `daysLengthening(date, lat)` in `api/_shared/season.ts`, which is
already pure with no imports. The client can import it; it already pulls from
`api/_shared/normal.ts`.

## Editorial rules Ron established

- **No Langstroth assumptions.** "Supers" presumes a hive type Ron does not run. His
  wording: *"Ensure adequate empty honeycomb cells for both honey and eggs"* and
  *"Add space if the bees are crowded."*
- **No claims about swarming being unlikely.** Hives do swarm in August; just do not
  mention swarming in the late-season text rather than asserting it will not happen.
- **"A late season flow"**, not "a late flow".
- **Contested practices get a conditional register.** Ron: *"treatments are a touchy subject
  in beekeeping. Even what constitutes a treatment. Some people consider feeding a
  treatment."* So: *"If you treat for mites, this is the window — before the winter bees are
  raised"* rather than an instruction. The same applies to feeding, which the current list
  is prescriptive about in three places.
- The safer register generally: **describe the condition, let the beekeeper decide the
  response.** "Hives may be running light" is inside what the app can see. "Feed sugar
  syrup" is not. NOT yet confirmed by Ron — flagged as a risk of being so hedged it stops
  being useful.

## Where this is going eventually

Ron: *"I would like to have a user profile that would state their preferences on these types
of issues, and modify accordingly."* So the conditional wording is an interim measure; the
real answer is per-user preferences (treatment-free, feeding philosophy, hive type) that
select the wording. Hive type is already known per apiary in places — `api/chat.ts` already
tells the AI to ask which hive type when advice depends on it, so the app solves this
correctly in exactly one place today.

## Drafted, awaiting Ron's edit

### Banner text, days SHORTENING

- IN_FLOW: "A late season flow is running. Ensure adequate empty honeycomb, though this is
  more likely winter stores than surplus."
- FLOW_STARTING: "A late season flow is starting. Expect stores rather than expansion.
  Ensure adequate empty honeycomb for what comes in."
- FLOW_ENDING: "Nectar flow is winding down into the dearth ahead. Monitor honey stores and
  watch for robbing behaviour."
- DEARTH: "Colony is in a dearth. Check that winter stores are adequate."
- TRANSITION: "Transitional forage conditions heading into autumn. Assess stores and watch
  for shifts in the next 1-2 weeks."

Days LENGTHENING keeps the current text, except IN_FLOW's "supers" line.

### Recommended Actions, days SHORTENING

**IN_FLOW**
- Add space if the bees are crowded, but leave enough for winter stores.
- Watch that nectar isn't filling the brood nest — the queen still needs room to lay.
- Natural forage is available now.

**FLOW_STARTING**
- Add space if the bees are crowded.
- Assess winter stores — this may be the last real chance to build them.
- Natural forage is coming in.

**FLOW_ENDING**
- Reduce hive entrances to protect against robbing.
- Heft or weigh hives to check winter stores are adequate.
- Hives may be running light as the season closes.

**DEARTH**
- Check winter stores; hives may be running light.
- Keep entrances reduced; robbing pressure is high in a dearth.
- If you treat for mites, this is the window — before the winter bees are raised.

**TRANSITION**
- Assess stores and colony population heading into autumn.
- Ensure bees have access to a clean water source nearby.
- Consider reducing entrances as the dearth deepens.

### Still uncertain, flagged for Ron

- The mite line at all — it is not a forage topic, and this is a nectar index. Possible
  scope creep.
- "Leave enough for winter stores" is deliberately unquantified; the number is regional and
  Albuquerque and Maine are different propositions.
- Nothing about splits in the autumn set. Spring's FLOW_ENDING says "avoid making splits";
  that is probably right in autumn too but for a different reason (no time to build), and it
  was not asserted in wording that had not been checked.

## Other Langstroth-specific text still live

- `NectarFlowV2View.tsx` getPhaseAdvice — the two lines above
- `AskAIView.tsx:193` — suggested prompt chip, "When should I add a super?"
- `src/features/nectar/engine.ts:260` and `api/nectar-index.ts:498` — V1 chain, already
  scoped for retirement
