# Fetcher settings, scored against beekeeper ground truth

Run 2026-08-27, twice. `scripts/score-fetcher-settings.mjs`, scoring against the checks in
`api/__tests__/groundTruth.ts` — the same definitions the test suite enforces, so a setting
cannot look good here and fail there.

Six configs, one setting varied at a time from the develop baseline, three sites
(South Valley, Murfreesboro, Tijeras), five-year window.

## Result

```
config                asserted   scenes    failing
develop baseline        16/16      1494    -
coverage 10%            16/16      1706    -
coverage 5%             16/16      1819    -
coverage 0%             14/16      2042    tij-winter-dead, tij-2026-summer-miss
no forage weight        16/16      1494    -
20 m resolution         16/16      1491    -
```

**Replicated exactly.** Two independent runs produced identical scores, scene counts and
monthly values to the point, so Earth Engine is deterministic here and these numbers are
solid.

## What it settles

**Coverage 0% is wrong.** It fails Tijeras winter and the 2026 summer miss, pushing June
from 0 to 13. The 2%-coverage scene on 23 August is junk and does real damage. So there IS
a floor — it just is not 20%.

## What it does NOT settle, and this is the important part

**Five of six configs pass everything.** Sixteen binary checks across three sites is too
coarse to choose between them. Meanwhile the numbers underneath move a great deal:

```
South Valley 2026     Mar  Apr  May  Jun  Jul  Aug
develop baseline       11   76   42    2    0    1
coverage 10%           10   78   32    0    0    2
coverage 5%            11   78   32    1    0    2
coverage 0%            11   78   36    0    0    1
no forage weight       10   77   29    1    0    5
20 m resolution        11   76   42    2    0    1

Murfreesboro 2026     Mar  Apr  May  Jun  Jul  Aug
develop baseline       64   39   23   21    2   12
coverage 10%           63   40   23   23    7   11
coverage 0%            63   47   24   23    7   10
no forage weight       63   43   33   18    5   16

Tijeras 2026          Mar  Apr  May  Jun  Jul  Aug
develop baseline        0    0    0    0   10   38
coverage 10%            0    0    1    4   11   37
coverage 0%             0    0    3   13   11   38
no forage weight        0    0    0    0   10   37
```

**South Valley May swings 42 -> 32 -> 29 with the score unchanged.** Ron on that month: *"The
May spike/flow was not actually noticeable at my yard, but it may have been high and short.
(I was not always in Albuquerque)"* — so the lower readings may be closer, and the suite
cannot see the difference.

## A measurement error worth remembering

The first run's timings looked decisive: baseline 174s, 20 m resolution 298s. That produced
a confident and WRONG conclusion that 20 m costs seven times the compute for no gain.

The replication showed every config at 35-43s, including 20 m at 36s. The first run's
figures were Earth Engine cold-cache cost, not the settings. **Timings from a sequence of
similar queries are not comparable.** Measuring resolution cost properly needs each config
run cold and in isolation.

So the 60 m decision — originally made for speed, 41s -> 19s — is neither confirmed nor
refuted here.

## Not tested

The strict vegetation-only cloud mask, which drops 26% of scenes (538 -> 396 at South
Valley). It is hardcoded in the fetcher rather than a parameter, so varying it needs a code
change. That is the largest untested change in the hardening.

## What this means for the suite itself

The suite works as a regression guard — it caught coverage 0% cleanly and twice. It does not
work as a way of choosing between reasonable options, because passing sixteen binary checks
is not the same as being right.

Making it discriminate would need graded checks rather than binary ones: not "was July 2026
a dearth" but "how close is July 2026 to what the beekeeper reported". That needs Ron to put
numbers on months he currently describes in words, which is a real ask and may not be
worth it.

## A rule about ground truth, learned the hard way

Ron, 2026-08-27: *"the comments I made about the May flow [were] assumptions, not
observations. My hive did not have resources in it, which may mean they didn't find the
small number of resources for a short flow."*

**An empty hive is an observation about the COLONY. A flow is a fact about the LANDSCAPE.**
The index models only the second. A short, thin flow that a weak or small colony failed to
exploit is indistinguishable, from inside the box, from no flow at all.

This invalidates an earlier argument in this project. "Ron left 28 April and returned to a
dry hive" was used to conclude the bloom model's 15 May peak was wrong and the satellite's
19 April peak was right. That conclusion may still be correct, but the evidence for it was
weaker than it was presented as.

**So the May figures cannot discriminate between fetch settings**, and the experiments are
left without a tie-breaker.

What DOES qualify as landscape observation, and is already encoded:
- Summer 2026 a dearth — multiple beekeepers, discussed at meetings
- Spring 2026 started early — swarm prevention began early, discussed at meetings
- Murfreesboro July 2026 — hives empty AND Ron present AND the whole area in it

The same caution applies to the hive-entrance video: "bees look busy" is also colony times
landscape. When collecting future ground truth, ask about the LANDSCAPE — what is blooming,
what the area's beekeepers are seeing — not only about the hive.

## Recommendation on the evidence actually available

Take **coverage 10%**: it fixes a known failure (the index going blind during monsoon) at no
measured cost on any check.

Leave **forage weighting** and **resolution** alone. No evidence either way, and changing
them on reasoning alone is exactly how the 20% coverage floor got in.
