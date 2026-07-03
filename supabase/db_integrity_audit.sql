-- ============================================================================
-- Data-integrity audit (READ-ONLY). Reports "orphan" rows — a child whose
-- reference column points at a parent that no longer exists. Deletes and
-- changes NOTHING; safe to run on any environment including production.
--
-- `guard = FK`  : a foreign key enforces this link, so orphans are impossible.
--                 A non-zero count here means the FK is MISSING in this DB.
-- `guard = none`: no enforcing FK — this is where orphans can actually exist.
--
-- Built from the production column map (2026-07-02). Re-run anytime as a health
-- check. Rows are ordered worst-first (most orphans at the top).
-- ============================================================================
select * from (
  -- ---------- Unprotected links (no FK — orphans possible) ----------
  select 'apiaries.user_id -> users' as link, 'none' as guard,
    (select count(*) from public.apiaries c where c.user_id is not null
       and not exists (select 1 from public.users p where p.id = c.user_id)) as orphans,
    (select count(*) from public.apiaries) as total_rows
  union all select 'ai_qa_history.user_id -> users', 'none',
    (select count(*) from public.ai_qa_history c where c.user_id is not null
       and not exists (select 1 from public.users p where p.id = c.user_id)),
    (select count(*) from public.ai_qa_history)
  union all select 'inspections.user_id -> users', 'none',
    (select count(*) from public.inspections c where c.user_id is not null
       and not exists (select 1 from public.users p where p.id = c.user_id)),
    (select count(*) from public.inspections)
  union all select 'inspections.snapshot_id -> hive_snapshots', 'none',
    (select count(*) from public.inspections c where c.snapshot_id is not null
       and not exists (select 1 from public.hive_snapshots p where p.id = c.snapshot_id)),
    (select count(*) from public.inspections)
  union all select 'interventions.inspection_id -> inspections', 'none',
    (select count(*) from public.interventions c where c.inspection_id is not null
       and not exists (select 1 from public.inspections p where p.id = c.inspection_id)),
    (select count(*) from public.interventions)
  union all select 'feature_requests.user_id -> users', 'none',
    (select count(*) from public.feature_requests c where c.user_id is not null
       and not exists (select 1 from public.users p where p.id = c.user_id)),
    (select count(*) from public.feature_requests)
  union all select 'feature_votes.user_id -> users', 'none',
    (select count(*) from public.feature_votes c where c.user_id is not null
       and not exists (select 1 from public.users p where p.id = c.user_id)),
    (select count(*) from public.feature_votes)
  union all select 'tasks.apiary_id -> apiaries', 'none',
    (select count(*) from public.tasks c where c.apiary_id is not null
       and not exists (select 1 from public.apiaries p where p.id = c.apiary_id)),
    (select count(*) from public.tasks)
  union all select 'tasks.hive_id -> hives', 'none',
    (select count(*) from public.tasks c where c.hive_id is not null
       and not exists (select 1 from public.hives p where p.id = c.hive_id)),
    (select count(*) from public.tasks)
  union all select 'tasks.assigned_user_id -> users', 'none',
    (select count(*) from public.tasks c where c.assigned_user_id is not null
       and not exists (select 1 from public.users p where p.id = c.assigned_user_id)),
    (select count(*) from public.tasks)
  union all select 'varroa_tests.user_id -> users', 'none',
    (select count(*) from public.varroa_tests c where c.user_id is not null
       and not exists (select 1 from public.users p where p.id = c.user_id)),
    (select count(*) from public.varroa_tests)

  -- ---------- FK-protected links (expect 0; non-zero = missing FK) ----------
  union all select 'hives.apiary_id -> apiaries', 'FK',
    (select count(*) from public.hives c where c.apiary_id is not null
       and not exists (select 1 from public.apiaries p where p.id = c.apiary_id)),
    (select count(*) from public.hives)
  union all select 'inspections.hive_id -> hives', 'FK',
    (select count(*) from public.inspections c where c.hive_id is not null
       and not exists (select 1 from public.hives p where p.id = c.hive_id)),
    (select count(*) from public.inspections)
  union all select 'interventions.hive_id -> hives', 'FK',
    (select count(*) from public.interventions c where c.hive_id is not null
       and not exists (select 1 from public.hives p where p.id = c.hive_id)),
    (select count(*) from public.interventions)
  union all select 'hive_snapshots.hive_id -> hives', 'FK',
    (select count(*) from public.hive_snapshots c where c.hive_id is not null
       and not exists (select 1 from public.hives p where p.id = c.hive_id)),
    (select count(*) from public.hive_snapshots)
  union all select 'varroa_tests.hive_id -> hives', 'FK',
    (select count(*) from public.varroa_tests c where c.hive_id is not null
       and not exists (select 1 from public.hives p where p.id = c.hive_id)),
    (select count(*) from public.varroa_tests)
  union all select 'weather_forecasts.apiary_id -> apiaries', 'FK',
    (select count(*) from public.weather_forecasts c where c.apiary_id is not null
       and not exists (select 1 from public.apiaries p where p.id = c.apiary_id)),
    (select count(*) from public.weather_forecasts)
  union all select 'inspection_attachments.inspection_id -> inspections', 'FK',
    (select count(*) from public.inspection_attachments c where c.inspection_id is not null
       and not exists (select 1 from public.inspections p where p.id = c.inspection_id)),
    (select count(*) from public.inspection_attachments)
  union all select 'inspection_attachments.parent_id -> inspection_attachments', 'FK',
    (select count(*) from public.inspection_attachments c where c.parent_id is not null
       and not exists (select 1 from public.inspection_attachments p where p.id = c.parent_id)),
    (select count(*) from public.inspection_attachments)
  union all select 'user_roles.user_id -> users', 'FK',
    (select count(*) from public.user_roles c where c.user_id is not null
       and not exists (select 1 from public.users p where p.id = c.user_id)),
    (select count(*) from public.user_roles)
  union all select 'feature_votes.feature_id -> feature_requests', 'FK',
    (select count(*) from public.feature_votes c where c.feature_id is not null
       and not exists (select 1 from public.feature_requests p where p.id = c.feature_id)),
    (select count(*) from public.feature_votes)
  union all select 'mentor_profiles.user_id -> users', 'FK',
    (select count(*) from public.mentor_profiles c where c.user_id is not null
       and not exists (select 1 from public.users p where p.id = c.user_id)),
    (select count(*) from public.mentor_profiles)
  union all select 'apiary_shares.apiary_id -> apiaries', 'FK',
    (select count(*) from public.apiary_shares c where c.apiary_id is not null
       and not exists (select 1 from public.apiaries p where p.id = c.apiary_id)),
    (select count(*) from public.apiary_shares)
  union all select 'apiary_shares.owner_id -> users', 'FK',
    (select count(*) from public.apiary_shares c where c.owner_id is not null
       and not exists (select 1 from public.users p where p.id = c.owner_id)),
    (select count(*) from public.apiary_shares)
  union all select 'apiary_shares.viewer_id -> users', 'FK',
    (select count(*) from public.apiary_shares c where c.viewer_id is not null
       and not exists (select 1 from public.users p where p.id = c.viewer_id)),
    (select count(*) from public.apiary_shares)
) audit
order by orphans desc, guard, link;
