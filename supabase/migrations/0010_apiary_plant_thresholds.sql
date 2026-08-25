-- Per-apiary bloom thresholds, computed once and kept.
--
-- A plant's bloom window is seeded as a calendar date per ecoregion, but the calendar is
-- blind to the year actually happening -- Albuquerque hit 90F in March 2026 and bloom ran
-- weeks early. So each heat-driven plant is converted to an accumulated-warmth threshold:
-- if the seed says chamisa peaks 15 September in this zone, and 15 September at THIS apiary
-- has averaged some accumulated warmth across the years on record, that figure becomes the
-- threshold and the plant tracks heat from then on.
--
-- Why per apiary and not per zone. Accumulated warmth is a property of a location, not of
-- an ecoregion: a Rio Grande bottomland yard and a Sandia foothills yard sit in the same
-- broad zone and accumulate very differently. zone_plants already carries gdd_start/peak/end
-- columns, but storing a derived threshold there would average away the elevation that
-- makes the two yards different. Those columns remain for a genuinely published,
-- location-independent figure if one is ever sourced.
--
-- Why stored rather than recomputed. A prior year's accumulated warmth on a given date is
-- fixed forever -- 15 June 2023 will never change -- so deriving it on every request is
-- waste. Recompute only when the plant list changes or another year of weather lands.
--
-- Safe to re-run.

create table if not exists public.apiary_plant_thresholds (
  id             uuid primary key default gen_random_uuid(),
  apiary_id      text not null references public.apiaries(id) on delete cascade,
  plant_id       uuid not null references public.plants(id)   on delete cascade,

  -- Which axis this plant is measured on. Heat-driven plants slide with the season;
  -- day-length-driven plants (chamisa, goldenrod, aster) must NOT, because they are
  -- short-day species and a heat shift makes them more wrong in an anomalous year.
  trigger_type   text not null check (trigger_type in ('gdd', 'photoperiod')),

  -- Accumulated growing degree days for 'gdd', day of year for 'photoperiod'.
  threshold_start numeric not null,
  threshold_peak  numeric not null,
  threshold_end   numeric not null,

  -- How many prior years of weather the average was taken over. Below two, treat the
  -- threshold as provisional: one freak season would have set it on its own.
  weather_years   integer not null,

  -- The zone list the windows came from, so a threshold can be traced back to its seed.
  zone_level      text,
  zone_code       text,

  computed_at     timestamptz not null default now()
);

-- One threshold per plant per apiary; recomputing overwrites rather than accumulating.
create unique index if not exists apiary_plant_thresholds_unique
  on public.apiary_plant_thresholds (apiary_id, plant_id);

create index if not exists apiary_plant_thresholds_apiary
  on public.apiary_plant_thresholds (apiary_id);

alter table public.apiary_plant_thresholds enable row level security;

-- Thresholds are derived from a user's own apiary location, so they follow the apiary's
-- ownership rather than being world-readable like the zone lists.
drop policy if exists "Users read own apiary thresholds" on public.apiary_plant_thresholds;
create policy "Users read own apiary thresholds"
  on public.apiary_plant_thresholds for select to authenticated
  using (
    exists (
      select 1 from public.apiaries a
      where a.id = apiary_plant_thresholds.apiary_id
        and (a.user_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists "Users write own apiary thresholds" on public.apiary_plant_thresholds;
create policy "Users write own apiary thresholds"
  on public.apiary_plant_thresholds for all to authenticated
  using (
    exists (
      select 1 from public.apiaries a
      where a.id = apiary_plant_thresholds.apiary_id
        and (a.user_id = auth.uid() or public.is_admin())
    )
  )
  with check (
    exists (
      select 1 from public.apiaries a
      where a.id = apiary_plant_thresholds.apiary_id
        and (a.user_id = auth.uid() or public.is_admin())
    )
  );
