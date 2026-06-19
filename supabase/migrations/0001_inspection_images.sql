-- Inspection images: additive feature, zero risk to existing data paths.
-- New table + private Storage bucket + owner-scoped RLS.
-- Mentor read-access is intentionally NOT included here — that cross-table
-- SELECT policy is the one risky change and is handled in its own migration.
--
-- Apply to the PREVIEW/Dev database first and verify before any promotion.

-- 1. Table -------------------------------------------------------------------
create table if not exists public.inspection_images (
  id            uuid primary key default gen_random_uuid(),
  inspection_id text not null references public.inspections(id) on delete cascade,
  owner         uuid not null references auth.users(id) on delete cascade,
  storage_path  text not null,   -- full-size object key in the bucket
  thumb_path    text not null,   -- thumbnail object key in the bucket
  width         integer,
  height        integer,
  byte_size     integer,
  created_at    timestamptz not null default now()
);

create index if not exists inspection_images_inspection_id_idx
  on public.inspection_images (inspection_id);

create index if not exists inspection_images_owner_idx
  on public.inspection_images (owner);

-- 2. Row Level Security — owner-only ----------------------------------------
alter table public.inspection_images enable row level security;

create policy "owner reads own inspection images"
  on public.inspection_images for select
  using (owner = auth.uid());

create policy "owner inserts own inspection images"
  on public.inspection_images for insert
  with check (owner = auth.uid());

create policy "owner updates own inspection images"
  on public.inspection_images for update
  using (owner = auth.uid())
  with check (owner = auth.uid());

create policy "owner deletes own inspection images"
  on public.inspection_images for delete
  using (owner = auth.uid());

-- 3. Storage bucket (private) ------------------------------------------------
insert into storage.buckets (id, name, public)
values ('inspection-images', 'inspection-images', false)
on conflict (id) do nothing;

-- Path convention: {owner_uid}/{inspection_id}/{uuid}.webp
-- The first path segment is the owner's uid, so policies gate on it.
create policy "owner reads own image objects"
  on storage.objects for select
  using (
    bucket_id = 'inspection-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "owner uploads own image objects"
  on storage.objects for insert
  with check (
    bucket_id = 'inspection-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "owner deletes own image objects"
  on storage.objects for delete
  using (
    bucket_id = 'inspection-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
