// Dashboard — SPEC B §1 (screenshots B02, B37, B38). The task list is shared (TaskPanel).

import { useState } from 'react';
import { Box, ClipboardList, MapPin, type LucideIcon } from 'lucide-react';
import { useApp } from '../../app/store';
import { TaskPanel } from '../../components/TaskList';

function StatTile({ icon: Icon, colour, value, label, onClick }: { icon: LucideIcon; colour: string; value: string | number; label: string; onClick?: () => void }) {
  const body = (
    <>
      <Icon size={20} className={colour} />
      <span className="mt-1.5 block text-2xl font-black text-text leading-none">{value}</span>
      <span className="mt-2 block text-[10px] font-black uppercase tracking-wider text-text-muted">{label}</span>
    </>
  );
  const cls = 'card flex-1 min-w-0 px-4 py-3.5 text-left !rounded-[1.4rem]';
  return onClick ? (
    <button type="button" onClick={onClick} className={`${cls} active:scale-[0.98] transition-transform`}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export default function DashboardScreen() {
  const { state, openApiariesTab, openHivesTab } = useApp();
  const [todo, setTodo] = useState<number | null>(null);

  return (
    <div className="max-w-2xl mx-auto px-4 pt-4">
      <h1 className="text-2xl leading-tight font-black text-text">
        Welcome back, <span className="text-primary">Beekeeper</span>!
      </h1>
      <p className="mt-1 text-sm text-text-muted">Here is an overview of your apiaries and hives today.</p>

      <div className="mt-5 flex gap-3">
        <StatTile icon={MapPin} colour="text-primary" value={state.apiaries.length} label="Apiaries" onClick={openApiariesTab} />
        <StatTile icon={Box} colour="text-primary" value={state.hives.length} label="Hives" onClick={openHivesTab} />
        <StatTile icon={ClipboardList} colour="text-blue-500" value={todo ?? '...'} label="To-Do" />
      </div>

      <hr className="my-8 border-divider" />

      <TaskPanel
        heading="My Tasks"
        subheading="Keep track of inspections and tasks."
        listTitle="My Upcoming Tasks"
        onChanged={t => setTodo(t.filter(x => x.status !== 'completed').length)}
      />
    </div>
  );
}
