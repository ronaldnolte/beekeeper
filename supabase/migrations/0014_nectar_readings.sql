-- ============================================================================
-- Saved nectar readings — one row per apiary, holding the raw satellite and
-- weather readings its nectar index is calculated from.
--
-- WHY. Every nectar load used to fetch six years of satellite scenes (Google
-- Earth Engine, 13-18 seconds) and weather (Open-Meteo) from scratch, although
-- everything older than a few weeks never changes. The server now saves what
-- it fetched here and, on the next load, only fetches the last three weeks
-- again (recent weather is revised and satellite scenes can arrive late).
--
-- RAW READINGS, NOT INDEX NUMBERS, on purpose: the formula is still tuned now
-- and then, and saved index numbers would all go stale with each tune. The
-- formula re-runs on these in well under a second.
--
-- NO ORPHANS. The row belongs to the apiary: deleting the apiary deletes it.
-- Moving the apiary is caught by built_lat/built_lon no longer matching, and
-- the same row is overwritten with a full fetch for the new spot.
--
-- SAFE TO EMPTY. Nothing else depends on this table. Deleting a row (or every
-- row) only means the next load for that apiary does the full fetch again.
--
-- Nothing existing changes. Apply to "Beekeeper Dev v2" first; production
-- only on promotion day, before the code goes live. Safe to re-run.
-- ============================================================================

create table if not exists public.nectar_readings (
  -- One row per apiary; deleting the apiary deletes it. apiaries.id is TEXT.
  apiary_id        text primary key references public.apiaries(id) on delete cascade,

  -- The owner, so the access rules below are a plain comparison.
  user_id          uuid not null references auth.users(id) on delete cascade,

  -- The spot the readings were fetched for (4 decimal places, about 11 metres,
  -- as the app sends it). When the apiary's spot no longer matches, the row is
  -- rebuilt.
  built_lat        numeric(9,4) not null,
  built_lon        numeric(9,4) not null,

  -- First day the saved readings cover (1 January, five years back). When the
  -- window needs earlier days than this, the row is rebuilt with a full fetch.
  covered_from     date not null,

  -- Last day fetched. The next load fetches again from three weeks before it.
  fetched_through  date not null,

  -- Satellite scenes with usable numbers: [{ "date", "ndvi", "evi", "ndwi" }]
  scenes           jsonb not null default '[]'::jsonb,

  -- Every day the satellite passed over, cloudy or not: ["YYYY-MM-DD", ...]
  pass_dates       jsonb not null default '[]'::jsonb,

  -- Daily weather: { "YYYY-MM-DD": { "tmax", "tmin", "dew" } }
  weather          jsonb not null default '{}'::jsonb,

  updated_at       timestamptz not null default now()
);

comment on table public.nectar_readings is
  'Saved raw satellite + weather readings per apiary, so nectar loads only fetch recent days. Safe to empty; see 0014.';

-- Tables made in the SQL editor do not get the API grants the dashboard adds.
-- Row-level security below still decides which rows anyone can touch.
grant select, insert, update, delete on table public.nectar_readings to authenticated;

-- Row-level security: only the apiary's owner can see or change its readings.
alter table public.nectar_readings enable row level security;

drop policy if exists "Owners read their nectar readings" on public.nectar_readings;
create policy "Owners read their nectar readings"
  on public.nectar_readings for select to authenticated
  using (user_id = auth.uid());

-- Writing also requires that the apiary really is the writer's own.
drop policy if exists "Owners create their nectar readings" on public.nectar_readings;
create policy "Owners create their nectar readings"
  on public.nectar_readings for insert to authenticated
  with check (user_id = auth.uid()
              and exists (select 1 from public.apiaries a
                          where a.id = apiary_id and a.user_id = auth.uid()));

drop policy if exists "Owners update their nectar readings" on public.nectar_readings;
create policy "Owners update their nectar readings"
  on public.nectar_readings for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid()
              and exists (select 1 from public.apiaries a
                          where a.id = apiary_id and a.user_id = auth.uid()));

drop policy if exists "Owners delete their nectar readings" on public.nectar_readings;
create policy "Owners delete their nectar readings"
  on public.nectar_readings for delete to authenticated
  using (user_id = auth.uid());

drop trigger if exists nectar_readings_set_updated_at on public.nectar_readings;
create trigger nectar_readings_set_updated_at
  before update on public.nectar_readings
  for each row execute function public.update_updated_at_column();

-- ----------------------------------------------------------------------------
-- Verification:
--   select column_name, data_type from information_schema.columns
--     where table_name = 'nectar_readings' order by ordinal_position;
--   select policyname, cmd from pg_policies where tablename = 'nectar_readings';
-- ----------------------------------------------------------------------------
