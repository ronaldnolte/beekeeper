// The hive's Tasks screen (view TASK_FORM, header "Task"). Deliberate change #6 (Ron,
// 2026-09-28): the live app jumped straight into a blank new task; this shows the hive's task
// list with the same "+ New Task" button, pencil and sheet as the Dashboard.

import { useApp } from '../../app/store';
import { TaskPanel } from '../../components/TaskList';
import { RecordTabs, ReturnToHiveBar } from './RecordParts';
import type { Task } from '../../lib/records';

export default function TaskScreen() {
  const { state } = useApp();
  const hive = state.hives.find(h => h.id === state.selectedHiveId);
  const rec = state.selectedRecord;
  const openTask = rec && rec.kind === 'task' ? (rec as unknown as Task) : null;
  if (!state.selectedHiveId) return null;
  return (
    <div className="max-w-2xl mx-auto px-2.5 pt-2 pb-36">
      <RecordTabs active="TASK_FORM" />
      <div className="px-1.5 pt-2">
        <TaskPanel hiveId={state.selectedHiveId} apiaryId={hive?.apiary_id} heading={hive?.name ?? 'Tasks'} subheading="Tasks for this hive." listTitle="Upcoming Tasks" openTask={openTask} />
      </div>
      <ReturnToHiveBar />
    </div>
  );
}
