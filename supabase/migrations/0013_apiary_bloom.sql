-- ============================================================================
-- Apiary bloom tables — one row per apiary holding its normal-year bloom table
-- (which master-list plants are nearby and when each blooms there).
--
-- Bloom plan step 2 (E:\claude\bloom-integration\PLAN.md). The row is built by
-- the server from GBIF + Daymet the first time Nectar is opened for an apiary,
-- and rebuilt when its location changes. Today's status (in bloom / starting
-- soon / ...) is NOT stored: the app works it out from the dates each day.
--
-- Plants are stored by their ID in the master list (its common name, which
-- api/_bloom's sync script keeps unique). Names, colours and nectar/pollen
-- scores are looked up from the master file, so correcting a plant there
-- shows for every apiary without a rebuild.
--
-- Nothing existing changes. Apply to "Beekeeper Dev v2" first; production
-- only on promotion day, before the code goes live. Safe to re-run.
-- ============================================================================

create table if not exists public.apiary_bloom (
  -- One table per apiary; deleting the apiary deletes it. apiaries.id is TEXT.
  apiary_id          text primary key references public.apiaries(id) on delete cascade,

  -- The owner, so the access rules below are a plain comparison.
  user_id            uuid not null references auth.users(id) on delete cascade,

  -- The point the table was built for. When the apiary's coordinates no longer
  -- match these, the table is out of date and is rebuilt.
  built_lat          double precision not null,
  built_lon          double precision not null,

  -- Circle the plant list came from (3-15 miles) and the "limited list" warning
  -- for sparsely recorded areas (null when the list is well recorded).
  radius_mi          integer not null,
  limited            boolean not null default false,
  warning            text,

  -- Normal-year heat the dates came from (e.g. '2016-2025') and the year-end
  -- total, kept for the full calendar screen's explanation.
  normal_years       text not null,
  normal_heat_year_end integer,

  -- The nearby plants: an array of
  --   { "plant": <master ID>, "presence": "Likely" | ..., "trigger": "GDD" | "LOD",
  --     "start": "MM-DD" | null, "end": "MM-DD" | null, "note": text }
  -- Dates are month-day of a normal year, so the table stays valid every year.
  plants             jsonb not null default '[]'::jsonb,

  built_at           timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on table public.apiary_bloom is
  'Normal-year bloom table per apiary (plant IDs + dates). Built by the server; see 0013.';

-- Tables made in the SQL editor do not get the API grants the dashboard adds.
-- Row-level security below still decides which rows anyone can touch.
grant select, insert, update, delete on table public.apiary_bloom to authenticated;

-- Row-level security: only the apiary's owner can see or change its bloom table.
alter table public.apiary_bloom enable row level security;

drop policy if exists "Owners read their apiary bloom" on public.apiary_bloom;
create policy "Owners read their apiary bloom"
  on public.apiary_bloom for select to authenticated
  using (user_id = auth.uid());

-- Writing also requires that the apiary really is the writer's own.
drop policy if exists "Owners create their apiary bloom" on public.apiary_bloom;
create policy "Owners create their apiary bloom"
  on public.apiary_bloom for insert to authenticated
  with check (user_id = auth.uid()
              and exists (select 1 from public.apiaries a
                          where a.id = apiary_id and a.user_id = auth.uid()));

drop policy if exists "Owners update their apiary bloom" on public.apiary_bloom;
create policy "Owners update their apiary bloom"
  on public.apiary_bloom for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid()
              and exists (select 1 from public.apiaries a
                          where a.id = apiary_id and a.user_id = auth.uid()));

drop policy if exists "Owners delete their apiary bloom" on public.apiary_bloom;
create policy "Owners delete their apiary bloom"
  on public.apiary_bloom for delete to authenticated
  using (user_id = auth.uid());

drop trigger if exists apiary_bloom_set_updated_at on public.apiary_bloom;
create trigger apiary_bloom_set_updated_at
  before update on public.apiary_bloom
  for each row execute function public.update_updated_at_column();

-- ----------------------------------------------------------------------------
-- Verification:
--   select column_name, data_type from information_schema.columns
--     where table_name = 'apiary_bloom' order by ordinal_position;
--   select policyname, cmd from pg_policies where tablename = 'apiary_bloom';
-- ----------------------------------------------------------------------------
