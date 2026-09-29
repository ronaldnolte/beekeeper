// Bottom sheet on phones, centred dialog on wide screens — SPEC F §2.

import { useEffect, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Overlay } from './Overlay';
import { MoreBelow } from './MoreBelow';

interface Props {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  /** Amber header bar with white title (the record sheets) or a plain cream header. */
  variant?: 'amber' | 'plain';
  maxHeight?: string;
  closeDisabled?: boolean;
  /** Gap between the "more below" hint and the sheet bottom (clears a sticky footer). */
  hintBottom?: number;
}

export function Sheet({ open, onClose, title, children, variant = 'amber', maxHeight = '90vh', closeDisabled, hintBottom = 16 }: Props) {
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !closeDisabled && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, closeDisabled]);

  if (!open) return null;
  return (
    <Overlay>
    <div
      className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-quick"
      onClick={() => !closeDisabled && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full sm:max-w-lg flex flex-col bg-bg rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-sheet-in"
        style={{ maxHeight, paddingBottom: 'env(safe-area-inset-bottom)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className={`flex items-center justify-between px-4 py-4 ${variant === 'amber' ? 'bg-primary text-white' : 'text-text'}`}>
          <h2 className={`font-black ${variant === 'amber' ? 'text-lg' : 'text-base'}`}>{title}</h2>
          <button type="button" aria-label="Close" disabled={closeDisabled} onClick={onClose} className="p-1 disabled:opacity-40">
            <X size={24} />
          </button>
        </div>
        <div ref={setScroller} className="flex-1 overflow-y-auto">{children}</div>
        {scroller && <MoreBelow scroller={scroller} className="absolute left-1/2 -translate-x-1/2 z-10" style={{ bottom: `calc(${hintBottom}px + env(safe-area-inset-bottom))` }} />}
      </div>
    </div>
    </Overlay>
  );
}
