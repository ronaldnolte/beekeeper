-- ============================================================================
-- Admin moderation for roadmap ideas (feature_requests):
--   * UPDATE — change status, or edit title/description (typos, inappropriate
--     wording). One row-level policy covers all columns.
--   * DELETE — remove spam/inappropriate requests outright. Votes go with the
--     request via ON DELETE CASCADE on feature_votes (referential actions run
--     as the system, so no vote-level policy is needed).
--
-- The roadmap UI shows these controls only to admins, but that's just UI.
-- These RLS policies are the real enforcement, gated on public.is_admin()
-- (already live from 0004; checks the caller's own role via user_roles).
--
-- Apply order: run on "Beekeeper Dev v2" first, confirm an admin can change a
-- status and a non-admin cannot, THEN run on production.
-- ============================================================================

-- RLS is expected to already be enabled on feature_requests; harmless if so.
alter table public.feature_requests enable row level security;

-- Idempotent: drop then recreate so re-running is safe.
drop policy if exists "Admins can update feature requests" on public.feature_requests;

create policy "Admins can update feature requests"
  on public.feature_requests
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can delete feature requests" on public.feature_requests;

create policy "Admins can delete feature requests"
  on public.feature_requests
  for delete
  to authenticated
  using (public.is_admin());

-- Deleting a request must take its votes with it. The feature_votes foreign
-- key predates the migrations folder and its constraint name / cascade setting
-- is unknown, so look it up and recreate it with ON DELETE CASCADE.
-- Idempotent: safe to re-run.
do $$
declare
  fk_name text;
begin
  select conname into fk_name
  from pg_constraint
  where conrelid = 'public.feature_votes'::regclass
    and confrelid = 'public.feature_requests'::regclass
    and contype = 'f';
  if fk_name is not null then
    execute format('alter table public.feature_votes drop constraint %I', fk_name);
  end if;
  alter table public.feature_votes
    add constraint feature_votes_feature_id_fkey
    foreign key (feature_id) references public.feature_requests(id)
    on delete cascade;
end $$;

-- NOTE: your own account must have the admin role for this to take effect. Check:
--   select role from public.user_roles where user_id = auth.uid();
-- If 'admin' isn't listed, add it (replace <your-user-uuid>):
--   insert into public.user_roles (user_id, role) values ('<your-user-uuid>', 'admin');
