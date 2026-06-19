-- ============================================================================
-- Inspection Plus — PRODUCTION cutover (one-shot, idempotent).
--
-- Dev was built iteratively (0001 then 0002, where 0002 drops 0001's table).
-- This consolidated script puts a fresh database into the SAME end state in a
-- single run, skipping the throwaway inspection_images table entirely.
--
-- What it creates:
--   1. private 'inspection-images' Storage bucket + owner-only object policies
--   2. review_status column on inspections (defaults 'approved' — existing rows
--      and Standard saves are unaffected; only Plus drafts set 'draft')
--   3. inspection_attachments table (photos + voice notes + captions) with
--      indexes, anon/authenticated grants, and owner-only RLS
--
-- Safe to re-run. Apply in the PRODUCTION project's SQL editor.
-- ============================================================================

-- 1. Storage bucket (private) + owner-scoped object policies ------------------
insert into storage.buckets (id, name, public)
values ('inspection-images', 'inspection-images', false)
on conflict (id) do nothing;

-- Path convention: {owner_uid}/{inspection_id}/{uuid}.webp — first segment gates.
drop policy if exists "owner reads own image objects" on storage.objects;
create policy "owner reads own image objects"
  on storage.objects for select
  using (
    bucket_id = 'inspection-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "owner uploads own image objects" on storage.objects;
create policy "owner uploads own image objects"
  on storage.objects for insert
  with check (
    bucket_id = 'inspection-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "owner deletes own image objects" on storage.objects;
create policy "owner deletes own image objects"
  on storage.objects for delete
  using (
    bucket_id = 'inspection-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 2. Draft/approved status on the existing inspections table ------------------
alter table public.inspections
  add column if not exists review_status text not null default 'approved';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'inspections_review_status_check'
  ) then
    alter table public.inspections
      add constraint inspections_review_status_check
      check (review_status in ('draft', 'approved'));
  end if;
end $$;

-- 3. Attachments table -------------------------------------------------------
create table if not exists public.inspection_attachments (
  id                uuid primary key default gen_random_uuid(),
  inspection_id     text not null references public.inspections(id) on delete cascade,
  owner             uuid not null references auth.users(id) on delete cascade,
  kind              text not null check (kind in ('photo', 'voice_note')),
  parent_id         uuid references public.inspection_attachments(id) on delete cascade,
  sort_order        integer not null default 0,
  storage_path      text,
  thumb_path        text,
  width             integer,
  height            integer,
  byte_size         integer,
  audio_path        text,
  transcript        text,
  transcript_status text not null default 'none'
                    check (transcript_status in ('none', 'pending', 'done', 'failed')),
  created_at        timestamptz not null default now()
);

create index if not exists inspection_attachments_inspection_id_idx
  on public.inspection_attachments (inspection_id);
create index if not exists inspection_attachments_owner_idx
  on public.inspection_attachments (owner);
create index if not exists inspection_attachments_parent_id_idx
  on public.inspection_attachments (parent_id);

-- 4. Table-level grants (raw-SQL tables don't inherit Supabase's defaults) ----
grant select, insert, update, delete
  on table public.inspection_attachments
  to anon, authenticated;

-- 5. Row Level Security — owner-only -----------------------------------------
alter table public.inspection_attachments enable row level security;

drop policy if exists "owner reads own attachments" on public.inspection_attachments;
create policy "owner reads own attachments"
  on public.inspection_attachments for select using (owner = auth.uid());

drop policy if exists "owner inserts own attachments" on public.inspection_attachments;
create policy "owner inserts own attachments"
  on public.inspection_attachments for insert with check (owner = auth.uid());

drop policy if exists "owner updates own attachments" on public.inspection_attachments;
create policy "owner updates own attachments"
  on public.inspection_attachments for update using (owner = auth.uid()) with check (owner = auth.uid());

drop policy if exists "owner deletes own attachments" on public.inspection_attachments;
create policy "owner deletes own attachments"
  on public.inspection_attachments for delete using (owner = auth.uid());
