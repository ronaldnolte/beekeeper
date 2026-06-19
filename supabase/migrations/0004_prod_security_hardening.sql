-- ============================================================================
-- PRODUCTION security hardening — run in the production SQL editor.
--
-- Closes issues surfaced by the Supabase Security Advisor (2026-06-19). These
-- concern leftover routines from the parked mentor/mentee system + its admin
-- panel; the admin-panel app code was not carried into the current build, so
-- nothing user-facing calls these — locking them down is safe.
--
-- CRITICAL: delete_user_entirely(uuid) is SECURITY DEFINER, does no caller
-- check, and was callable by anon (not signed in) — i.e. anyone could erase any
-- account and all its data. Account deletion is handled manually/by email, so
-- the public never needs to call it.
-- ============================================================================

-- 1. Block public access to the account-wipe routine.
revoke execute on function public.delete_user_entirely(uuid) from anon, authenticated;

-- 2. Admin email lookup already refuses non-admins internally; also close it to anon.
revoke execute on function public.get_user_by_email_for_admin(text) from anon;

-- 3. Trigger helpers should never be called directly via the API.
--    (Revoking EXECUTE does NOT disable the triggers — sign-up + timestamps keep working.)
revoke execute on function public.handle_new_user() from anon, authenticated;
revoke execute on function public.update_updated_at_column() from anon, authenticated;

-- 4. Pin search_path on the flagged routines (hardening, no behavior change).
alter function public.delete_user_entirely(uuid)        set search_path = public, pg_temp;
alter function public.get_user_by_email_for_admin(text) set search_path = public, pg_temp;
alter function public.handle_new_user()                 set search_path = public, pg_temp;
alter function public.update_updated_at_column()        set search_path = public, pg_temp;
alter function public.is_admin()                        set search_path = public, pg_temp;
alter function public.check_hive_access(uuid)           set search_path = public, pg_temp;

-- Left intentionally callable: is_admin(), check_hive_access() only ever check the
-- caller's OWN access and are likely used by RLS policies — do not revoke them.

-- Also recommended (dashboard, not SQL): Authentication -> Settings ->
-- enable "Leaked password protection".
--
-- When the mentor system is un-parked and the admin panel is rebuilt, re-grant
-- EXECUTE on the admin routines only behind an admin check (e.g.
-- `if not public.is_admin() then raise exception ...`), never wide open.
