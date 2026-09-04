-- ============================================================================
-- User profiles — one row per beekeeper, holding the preferences that change
-- what the app does.
--
-- The app has never had a profile or settings screen. Three things already on
-- the backlog had nowhere to live because of it: changing a password without
-- pretending you forgot it, opting out of analytics, and deleting an account.
-- This is the table those hang off.
--
-- Design rule agreed with Ron 2026-08-31: every column here must change
-- something the app DOES, or it is a form field nobody fills in. Each one
-- below names the behaviour it drives.
--
-- Apply to "Beekeeper Dev v2" first. Safe to re-run.
-- ============================================================================

create table if not exists public.profiles (
  -- Same id as the auth user. One profile per account, no separate key needed.
  id                  uuid primary key references auth.users(id) on delete cascade,

  -- Shown in the header and on the profile screen. Optional: the app works
  -- perfectly well addressing nobody by name.
  display_name        text,

  -- Drives how much explanation advice text carries. Null means "not said",
  -- which is different from 0 (a first-year beekeeper) and must stay different.
  experience_years    integer check (experience_years is null
                                     or (experience_years >= 0 and experience_years <= 80)),

  -- Prefills the hive form. Values match what HiveFormModal already writes to
  -- hives.type, so a preference and a hive record speak the same language.
  default_hive_type   text check (default_hive_type is null
                                  or default_hive_type in ('Top Bar', 'Langstroth')),

  -- Prefills the bar count for Top Bar hives (the form's own default is 30).
  default_bar_count   integer check (default_bar_count is null
                                     or (default_bar_count >= 1 and default_bar_count <= 60)),

  -- Filters which options the varroa flow offers after a mite count. A
  -- treatment-free beekeeper should not be handed a list of miticides.
  treatment_approach  text check (treatment_approach is null
                                  or treatment_approach in
                                     ('treatment_free', 'organic', 'conventional', 'undecided')),

  -- Gates the Google Analytics loader in src/main.tsx. Its absence is why the
  -- Play Data Safety form has to declare analytics as "can't turn off".
  analytics_opt_out   boolean not null default false,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

comment on table public.profiles is
  'One row per beekeeper. Every column drives app behaviour; see 0012 for which.';

-- Row-level security: a profile is visible and writable only by its owner.
-- No cross-user reads at all — nothing in the app shows one user another's
-- profile, and the read-only apiary sharing schema does not touch this table.
alter table public.profiles enable row level security;

drop policy if exists "Owners can read their own profile" on public.profiles;
create policy "Owners can read their own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Owners can create their own profile" on public.profiles;
create policy "Owners can create their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Owners can update their own profile" on public.profiles;
create policy "Owners can update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- No delete policy on purpose. A profile dies with its auth user through the
-- foreign key; nothing in the app should delete a profile on its own.

-- Keep updated_at honest. update_updated_at_column() already exists and is
-- used by other tables; it is a trigger helper and is not callable over the
-- API (see 0011).
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at_column();

-- ----------------------------------------------------------------------------
-- Verification:
--   select column_name, data_type from information_schema.columns
--     where table_name = 'profiles' order by ordinal_position;
--   select policyname, cmd from pg_policies where tablename = 'profiles';
-- ----------------------------------------------------------------------------
