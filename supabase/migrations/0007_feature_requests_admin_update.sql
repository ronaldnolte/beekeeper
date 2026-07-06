-- ============================================================================
-- Let admins update roadmap ideas (feature_requests) — e.g. change status.
--
-- The roadmap UI shows status controls only to admins, but that's just UI.
-- This RLS policy is the real enforcement: UPDATE on feature_requests is
-- permitted only when public.is_admin() returns true for the caller. is_admin()
-- already exists in production (see 0004) and checks the caller's own role via
-- user_roles, so no new function is needed.
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

-- NOTE: your own account must have the admin role for this to take effect. Check:
--   select role from public.user_roles where user_id = auth.uid();
-- If 'admin' isn't listed, add it (replace <your-user-uuid>):
--   insert into public.user_roles (user_id, role) values ('<your-user-uuid>', 'admin');
