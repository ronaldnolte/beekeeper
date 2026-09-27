// "Select Apiary" card with one button per apiary — Forecast and Ask AI (screenshots B03, B04).

import type { Apiary } from '../lib/supabase';

export function ApiaryButtonsCard({ apiaries, subtitle, onPick }: { apiaries: Apiary[]; subtitle: string; onPick: (a: Apiary) => void }) {
  return (
    <div className="rounded-[2rem] bg-white/90 shadow-[0_8px_30px_rgba(0,0,0,0.06)] px-8 py-10 text-center">
      <h2 className="text-lg font-black text-text">Select Apiary</h2>
      <p className="mt-2 text-sm text-text-muted">{subtitle}</p>
      <div className="mt-6 space-y-2">
        {apiaries.map(a => (
          <button
            key={a.id}
            type="button"
            onClick={() => onPick(a)}
            className="w-full h-[54px] rounded-3xl bg-white border border-transparent shadow-[0_4px_16px_rgba(0,0,0,0.05)] text-sm font-bold text-text hover:border-primary focus-visible:border-primary outline-none"
          >
            {a.name}
          </button>
        ))}
      </div>
    </div>
  );
}

export function EmptyApiariesCard({ message }: { message: string }) {
  return (
    <div className="rounded-[2rem] bg-white/90 shadow-[0_8px_30px_rgba(0,0,0,0.06)] px-8 py-10 text-center">
      <h2 className="text-xl font-black text-text">No Apiaries Found</h2>
      <p className="mt-2 text-text-muted">{message}</p>
    </div>
  );
}
