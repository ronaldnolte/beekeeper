// The "Task" view — SPEC A §3, SPEC B §3 (screenshot B36): the task sheet over an empty page.
// Opened from the hive action bar (new task for this hive), the Tasks sub-tab, or a task in
// the hive's history (edit). Closing the sheet returns to Hive Detail.

import { useApp } from '../../app/store';
import { TaskSheet } from '../../components/TaskSheet';
import type { Task } from '../../lib/records';

export default function TaskScreen() {
  const { state, goBack } = useApp();
  const rec = state.selectedRecord;
  const task = rec && rec.kind === 'task' ? (rec as unknown as Task) : null;
  const hive = state.hives.find(h => h.id === state.selectedHiveId);
  return <TaskSheet open onClose={goBack} onSaved={() => {}} task={task} defaultHiveId={state.selectedHiveId} defaultApiaryId={hive?.apiary_id ?? state.selectedApiaryId} />;
}
