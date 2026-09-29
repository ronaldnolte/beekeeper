// The edit (pencil) and delete (trash) hints on tappable list items — the same square the
// apiary list uses (deliberate change #6: one edit cue on every screen).

import { Pencil, Trash2 } from 'lucide-react';

const SIDE = 'w-11 h-11 shrink-0 rounded-2xl bg-card-bg border border-card-border shadow-sm flex items-center justify-center text-text-muted';

/** Decorative: the whole card is the button, so this is a span, not a nested button. */
export function EditPencil() {
  return (
    <span className={SIDE} aria-hidden="true">
      <Pencil size={18} />
    </span>
  );
}

export function DeleteHint() {
  return (
    <span className={`${SIDE} text-red-500`} aria-hidden="true">
      <Trash2 size={18} />
    </span>
  );
}
