-- ============================================================================
-- Cascading deletes for the apiary → hive → children chain.
--
-- Today four foreign keys are ON DELETE NO ACTION, which is why
-- apiaryRepository.deleteApiaryWithCascade has to delete every child table by
-- hand (11 queries) and then re-verify. Switching these to ON DELETE CASCADE
-- lets the database clean up children automatically when a parent is removed,
-- so the client-side cascade can collapse to a single delete.
--
-- Verified against the preview DB (2026-07-02). These four were NO ACTION;
-- varroa_tests.hive_id, weather_forecasts.apiary_id, and
-- inspection_attachments.* were already CASCADE and are left as-is.
--
-- Test on the PREVIEW project first. Apply to production only after verifying.
-- ============================================================================

begin;

-- apiaries → hives
alter table public.hives drop constraint hives_apiary_id_fkey;
alter table public.hives add constraint hives_apiary_id_fkey
  foreign key (apiary_id) references public.apiaries(id) on delete cascade;

-- hives → inspections
alter table public.inspections drop constraint inspections_hive_id_fkey;
alter table public.inspections add constraint inspections_hive_id_fkey
  foreign key (hive_id) references public.hives(id) on delete cascade;

-- hives → interventions
alter table public.interventions drop constraint interventions_hive_id_fkey;
alter table public.interventions add constraint interventions_hive_id_fkey
  foreign key (hive_id) references public.hives(id) on delete cascade;

-- hives → hive_snapshots
alter table public.hive_snapshots drop constraint hive_snapshots_hive_id_fkey;
alter table public.hive_snapshots add constraint hive_snapshots_hive_id_fkey
  foreign key (hive_id) references public.hives(id) on delete cascade;

commit;

-- NOT handled here, on purpose:
--  * public.tasks has NO foreign key at all on hive_id / apiary_id, so deleting
--    a hive or apiary currently orphans its tasks. Adding those FKs (with
--    CASCADE) is worthwhile but needs an orphan-row + column-type check first,
--    so it's deferred to its own migration.
--  * inspection_attachments cascades in the DB, but the underlying Storage
--    objects (photos/audio) are NOT removed by a DB cascade — that cleanup
--    still has to happen in app code (deleteAttachmentStorageForInspection).
