-- ============================================================================
-- Revoke the leftover admin routines from PUBLIC — the fix migration 0004
-- should have been.
--
-- WHY 0004 DID NOT WORK. Postgres grants every new function a blanket EXECUTE
-- to the PUBLIC pseudo-role on creation. That is a SEPARATE grant from the ones
-- held by `anon` and `authenticated`, and those roles inherit through it. So
-- 0004's `revoke ... from anon, authenticated` left the PUBLIC grant standing
-- and changed nothing: on 2026-07-03 `has_function_privilege('anon', ...)` still
-- returned TRUE for delete_user_entirely on live production, and `proacl` showed
-- a leading `=X/postgres` — the empty left-hand side means PUBLIC.
--
-- For roughly two weeks anyone unauthenticated could still call
-- delete_user_entirely and erase any account. No evidence it was exploited.
--
-- The statements below were applied BY HAND to production (ayeqrbcvihztxbrxmrth)
-- on 2026-07-03 and verified. This file exists so the fix is reproducible and
-- cannot silently regress when the schema is rebuilt from the repo.
--
-- Safe to re-run: revoking a privilege that is already absent is a no-op.
-- ============================================================================

-- The account-wipe routine. SECURITY DEFINER with no caller check, so nothing
-- outside the database should be able to reach it at all. Account deletion in
-- the app is manual/by email (public/delete-account.html).
revoke execute on function public.delete_user_entirely(uuid)
  from public, anon, authenticated;

-- Admin email lookup. `authenticated` is kept ON PURPOSE: the function checks
-- is_admin() internally and refuses non-admins, and revoking it would break the
-- admin path if it is ever rebuilt. Only PUBLIC and anon are closed here.
revoke execute on function public.get_user_by_email_for_admin(text)
  from public, anon;

-- Trigger helpers. These fire from triggers, which do not consult EXECUTE
-- grants, so revoking does NOT break sign-up or updated_at timestamps.
revoke execute on function public.handle_new_user()
  from public, anon, authenticated;
revoke execute on function public.update_updated_at_column()
  from public, anon, authenticated;

-- Deliberately NOT revoked: is_admin() and check_hive_access(uuid). Both only
-- ever check the CALLER's own access, and RLS policies depend on them for
-- signed-in users.

-- ----------------------------------------------------------------------------
-- Verification. Expected: anon false everywhere; authenticated false except
-- get_user_by_email_for_admin, which stays true by design.
--
--   select
--     p.proname,
--     has_function_privilege('anon',          p.oid, 'EXECUTE') as anon_can_call,
--     has_function_privilege('authenticated', p.oid, 'EXECUTE') as authed_can_call
--   from pg_proc p
--   join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public'
--     and p.proname in (
--       'delete_user_entirely',
--       'get_user_by_email_for_admin',
--       'handle_new_user',
--       'update_updated_at_column'
--     )
--   order by p.proname;
-- ----------------------------------------------------------------------------
