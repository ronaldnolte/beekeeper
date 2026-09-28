// Shared record-screen pieces — SPEC B §13, SPEC F §2 (screenshots B26–B35).

import type { ReactNode } from 'react';
import { Hexagon, Save, Trash2 } from 'lucide-react';
import { useApp } from '../../app/store';
import type { View } from '../../app/views';

const TABS: [string, View][] = [
  ['Inspections', 'INSPECTION_FORM'],
  ['Interventions', 'INTERVENTION_FORM'],
  ['Varroa', 'VARROA_FORM'],
  ['Tasks', 'TASK_FORM'],
];

/** Tapping a tab clears the selected record and opens that view. */
export function RecordTabs({ active }: { active: View }) {
  const { navigate, selectRecord } = useApp();
  const current = active === 'INSPECTION_PLUS' ? 'INSPECTION_FORM' : active;
  return (
    <div className="flex justify-around border-b border-divider mb-4">
      {TABS.map(([label, view]) => {
        const on = view === current;
        return (
          <button
            key={view}
            type="button"
            onClick={() => {
              selectRecord(null);
              navigate(view, { keepRecord: false });
            }}
            className={`relative px-1.5 pt-2 pb-3 text-[11px] font-bold uppercase tracking-wider ${on ? 'text-primary-ink font-black' : 'text-text-muted'}`}
          >
            {label}
            {on && <span className="absolute left-2 right-2 -bottom-[1px] h-[3px] rounded-full bg-primary" style={{ boxShadow: '0 0 8px var(--color-primary-glow)' }} />}
          </button>
        );
      })}
    </div>
  );
}

/** White-75 blurred bar fixed at the bottom of record screens. */
export function BottomBar({ children, gap = "gap-4" }: { children: ReactNode; gap?: string }) {
  return (
    <div className="fixed bottom-0 inset-x-0 z-40 bg-white/75 backdrop-blur-md border-t border-white/40" style={{ padding: '16px 16px calc(16px + env(safe-area-inset-bottom))' }}>
      <div className={`max-w-2xl mx-auto flex ${gap}`}>{children}</div>
    </div>
  );
}

export function ReturnToHiveBar() {
  const { goBack } = useApp();
  return (
    <BottomBar>
      <button type="button" onClick={goBack} className="flex-1 h-[70px] rounded-full bg-white/60 shadow-sm flex flex-col items-center justify-center gap-1 font-bold text-text">
        <Hexagon size={22} />
        <span className="text-[13px]">Return to Hive Details</span>
      </button>
    </BottomBar>
  );
}

export function TrashButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" aria-label="Delete" onClick={onClick} disabled={disabled} className="w-12 h-12 shrink-0 rounded-2xl bg-red-500 text-white flex items-center justify-center shadow-md disabled:opacity-50">
      <Trash2 size={22} />
    </button>
  );
}

export function SaveButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="flex-1 h-12 rounded-2xl bg-primary text-white text-lg font-black flex items-center justify-center gap-3 shadow-md disabled:opacity-60">
      <Save size={22} /> {label}
    </button>
  );
}

export function CardSection({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`card p-2.5 ${className}`}>{children}</div>;
}

export function SectionTitle({ icon, children }: { icon?: string; children: ReactNode }) {
  return (
    <h3 className="flex items-center gap-3 mb-3 text-sm font-black uppercase tracking-wider text-text-muted">
      {icon && <span aria-hidden="true">{icon}</span>}
      {children}
    </h3>
  );
}

/** Full-grow pills; selected = amber border + amber tint + amber text. */
export function PillGroup({ options, value, onChange, label }: { options: readonly (readonly [string, string])[]; value: string | null; onChange: (v: string) => void; label: string }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={label}>
      {options.map(([text, v]) => {
        const on = v === value;
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(v)}
            className={`flex-grow h-[34px] px-2.5 rounded-2xl border-2 text-sm font-bold transition-colors ${on ? 'border-primary bg-primary/15 text-primary' : 'border-transparent bg-white/70 text-text-muted'}`}
          >
            {text}
          </button>
        );
      })}
    </div>
  );
}
