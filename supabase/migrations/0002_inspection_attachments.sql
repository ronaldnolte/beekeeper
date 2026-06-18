-- Inspection Plus: replace the too-narrow inspection_images table with a single
-- attachments table that holds the mixed feed (photos + voice notes + captions),
-- and add a draft/approved status to inspections.
--
-- Additive to existing behavior: the new column defaults to 'approved', so every
-- existing inspection and every Standard save is unaffected. Only Plus drafts
-- set 'draft'. The private 'inspection-images' bucket + its owner-only storage
-- policies from 0001 are reused for both images and audio.
--
-- Apply to the PREVIEW/Dev database. Safe to re-run.

-- 0. Drop the empty photos-only table from 0001 (its RLS policies drop with it).
drop table if exists public.inspection_images cascade;

-- 1. Draft/approved status on the existing inspections table -----------------
alter table public.inspections
  add column if not exists review_status text not null default 'approved';

-- Guard the allowed values (added separately so re-runs don't error).
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

-- 2. Attachments table -------------------------------------------------------
-- One row per feed item. A photo's caption is a voice_note with parent_id set
-- to the photo's id; a standalone note is a voice_note with parent_id null.
create table if not exists public.inspection_attachments (
  id                uuid primary key default gen_random_uuid(),
  inspection_id     text not null references public.inspections(id) on delete cascade,
  owner             uuid not null references auth.users(id) on delete cascade,
  kind              text not null check (kind in ('photo', 'voice_note')),
  parent_id         uuid references public.inspection_attachments(id) on delete cascade,
  sort_order        integer not null default 0,
  -- photo fields
  storage_path      text,
  thumb_path        text,
  width             integer,
  height            integer,
  byte_size         integer,
  -- voice fields (audio_path is scaffolding — cleared/deleted on approval)
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

-- 3. Row Level Security — owner-only ----------------------------------------
alter table public.inspection_attachments enable row level security;

create policy "owner reads own attachments"
  on public.inspection_attachments for select using (owner = auth.uid());
create policy "owner inserts own attachments"
  on public.inspection_attachments for insert with check (owner = auth.uid());
create policy "owner updates own attachments"
  on public.inspection_attachments for update using (owner = auth.uid()) with check (owner = auth.uid());
create policy "owner deletes own attachments"
  on public.inspection_attachments for delete using (owner = auth.uid());
