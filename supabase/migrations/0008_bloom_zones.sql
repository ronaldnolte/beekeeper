-- ============================================================================
-- Bloom / forage zones and field observations.
--
-- Plant lists are keyed by EPA (Omernik) ECOREGION, not by USDA hardiness zone.
-- Hardiness zones encode average winter minimum temperature -- what survives the
-- cold -- not what grows somewhere or when it blooms; Albuquerque and middle
-- Tennessee are both 7a. Ecoregions are built from vegetation, landform, soils,
-- hydrology and climate. The two New Mexico apiaries sit 30 km apart and fall in
-- different LEVEL III regions (22g Rio Grande Floodplain vs 23e Conifer
-- Woodlands and Savannas), which is exactly the distinction that matters.
--
-- Shape:
--   plants             species master: name and photo, which do not vary by zone
--   zone_plants        the researched facts per zone: bloom window, GDD, nectar
--                      value. Goldenrod in Maine and in the Rio Grande valley
--                      are different propositions.
--   field_observations what users report from the field
--
-- Lists resolve L4 -> L3 -> national, so an apiary in an uncurated Level IV
-- still gets its Level III list, and anywhere outside the conterminous US
-- (Alaska, Hawaii, international -- the resolver returns null there) still gets
-- the national fallback.
--
-- NOTE: apiaries.id is TEXT, not uuid (confirmed against the live table).
--
-- This file is idempotent (add column if not exists / create table if not exists /
-- drop policy if exists), so it is safe to re-run after an amendment.
--
-- Apply order: run on "Beekeeper Dev v2" FIRST and exercise the app against it,
-- THEN production. Never the other way round.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Cache the resolved ecoregion on the apiary.
--    Resolved lazily. Null codes with a null resolved_at means "not looked up
--    yet"; null codes WITH a resolved_at means "looked up and outside coverage",
--    which must not be retried on every load.
--    Note many apiaries currently hold only a zip_code with null lat/lng, so
--    those need geocoding before a zone can be resolved at all.
-- ---------------------------------------------------------------------------
alter table public.apiaries add column if not exists ecoregion_l3 text;
alter table public.apiaries add column if not exists ecoregion_l4 text;
alter table public.apiaries add column if not exists ecoregion_resolved_at timestamptz;

-- Which coordinates the zone was derived from. An apiary holding only a zip code
-- still gets a zone (the client geocodes the zip for the nectar index already), but
-- a zip centroid is coarse: the two New Mexico apiaries sit 30 km apart in DIFFERENT
-- Level III ecoregions, so a zip spanning valley and foothills can land on the wrong
-- side of that line. Recording the source lets the UI mark such a zone approximate,
-- and lets us re-resolve once real coordinates are added.
alter table public.apiaries add column if not exists ecoregion_source text
  check (ecoregion_source is null or ecoregion_source in ('coordinates','zip'));

-- ---------------------------------------------------------------------------
-- 2. Species master.
-- ---------------------------------------------------------------------------
create table if not exists public.plants (
  id                 uuid primary key default gen_random_uuid(),
  common_name        text not null,
  scientific_name    text,
  photo_url          text,
  photo_attribution  text,          -- required by CC-BY / iNaturalist terms
  created_at         timestamptz not null default now()
);
create unique index if not exists plants_common_name_key on public.plants (lower(common_name));

-- ---------------------------------------------------------------------------
-- 3. Per-zone facts. A Level IV row overrides a Level III row for the same
--    species; a 'national' row (zone_code null) is the last resort.
--    `source` is MANDATORY: this work began by finding saguaro cactus in a New
--    Mexico plant list with no way to trace where it came from.
-- ---------------------------------------------------------------------------
create table if not exists public.zone_plants (
  id            uuid primary key default gen_random_uuid(),
  zone_level    text not null check (zone_level in ('l4','l3','national')),
  zone_code     text,               -- '22g', '22', or null when zone_level='national'
  plant_id      uuid not null references public.plants(id) on delete cascade,
  bloom_start   text,               -- MM-DD
  bloom_peak    text,
  bloom_end     text,
  gdd_start     numeric,            -- populated as it becomes known
  gdd_peak      numeric,
  gdd_end       numeric,
  nectar_value  numeric check (nectar_value >= 0 and nectar_value <= 1),
  source        text not null,      -- 'USDA NRCS TN-71', 'Nashville Beekeepers', 'user-promoted'
  confidence    text check (confidence in ('high','medium','low')),
  created_at    timestamptz not null default now(),
  constraint zone_code_matches_level check (
    (zone_level = 'national' and zone_code is null) or
    (zone_level in ('l3','l4') and zone_code is not null)
  )
);
create unique index if not exists zone_plants_unique
  on public.zone_plants (zone_level, coalesce(zone_code, ''), plant_id);
create index if not exists zone_plants_lookup on public.zone_plants (zone_level, zone_code);

-- ---------------------------------------------------------------------------
-- 4. Field observations.
--    Zone codes are captured HERE as well as on the apiary: if an apiary is
--    later moved or its coordinates corrected, historical observations must keep
--    the zone they were actually made in, or the phenology record silently
--    rewrites itself.
--    plant_id is nullable. "I do not know what this is, but the bees love it" is
--    the most valuable observation we can collect, because the forb layer -- the
--    pasture and roadside plants that cover the dearth months -- is exactly what
--    published species lists miss.
-- ---------------------------------------------------------------------------
create table if not exists public.field_observations (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  apiary_id         text references public.apiaries(id) on delete cascade,
  zone_l3           text,
  zone_l4           text,
  observation_type  text not null default 'bloom'
                    check (observation_type in ('bloom','colony_gain')),
  plant_id          uuid references public.plants(id) on delete set null,
  photo_url         text,
  note              text,
  verdict           text not null check (verdict in ('yes','no')),
  was_predicted     boolean not null default false,
  gdd_value         numeric,
  observed_on       date not null default current_date,
  created_at        timestamptz not null default now()
);
create index if not exists field_observations_zone
  on public.field_observations (zone_l4, zone_l3, observed_on);
create index if not exists field_observations_user
  on public.field_observations (user_id, observed_on desc);

-- ---------------------------------------------------------------------------
-- 5. RLS. Reference data is readable by any signed-in user and admin-writable
--    (same shape as the roadmap tables in 0007). Observations are private to
--    their owner, with admins able to read across for calibration.
-- ---------------------------------------------------------------------------
alter table public.plants             enable row level security;
alter table public.zone_plants        enable row level security;
alter table public.field_observations enable row level security;

drop policy if exists "Anyone signed in can read plants" on public.plants;
create policy "Anyone signed in can read plants"
  on public.plants for select to authenticated using (true);

drop policy if exists "Admins manage plants" on public.plants;
create policy "Admins manage plants"
  on public.plants for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Anyone signed in can read zone plants" on public.zone_plants;
create policy "Anyone signed in can read zone plants"
  on public.zone_plants for select to authenticated using (true);

drop policy if exists "Admins manage zone plants" on public.zone_plants;
create policy "Admins manage zone plants"
  on public.zone_plants for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Users read own observations" on public.field_observations;
create policy "Users read own observations"
  on public.field_observations for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Users insert own observations" on public.field_observations;
create policy "Users insert own observations"
  on public.field_observations for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users update own observations" on public.field_observations;
create policy "Users update own observations"
  on public.field_observations for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Users delete own observations" on public.field_observations;
create policy "Users delete own observations"
  on public.field_observations for delete to authenticated
  using (user_id = auth.uid());
