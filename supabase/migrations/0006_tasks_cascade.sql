-- ============================================================================
-- Add the missing foreign keys on public.tasks, with ON DELETE CASCADE.
--
-- tasks.hive_id and tasks.apiary_id had NO foreign key at all, so deleting a
-- hive or apiary orphaned its tasks (the client-side cascade deleted them by
-- hand instead). Adding these links — matching the text id types, both columns
-- nullable so apiary-level and hive-level tasks both work — lets tasks cascade
-- with their parent like every other child record.
--
-- Verified against preview (2026-07-02): columns all text, 0 orphan rows on
-- both hive_id and apiary_id, so ADD CONSTRAINT will not fail on existing data.
--
-- Pairs with 0005_cascade_deletes.sql. Test on PREVIEW first, then production.
-- ============================================================================

begin;

alter table public.tasks add constraint tasks_hive_id_fkey
  foreign key (hive_id) references public.hives(id) on delete cascade;

alter table public.tasks add constraint tasks_apiary_id_fkey
  foreign key (apiary_id) references public.apiaries(id) on delete cascade;

commit;
