// Export / Share action sheet — SPEC B §16 (screenshot B29).

import { useState } from 'react';
import { FileText, ImageDown, X } from 'lucide-react';
import { Overlay } from '../../components/Overlay';
import { Spinner } from '../../components/Chrome';
import { useApp } from '../../app/store';
import { buildReport, savePhotos } from '../../lib/exportFiles';

export function ExportSheet({ inspectionId, onClose }: { inspectionId: string; onClose: () => void }) {
  const { state } = useApp();
  const [busy, setBusy] = useState<'pdf' | 'photos' | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const hiveName = state.hives.find(h => h.id === state.selectedHiveId)?.name ?? null;

  const run = async (kind: 'pdf' | 'photos') => {
    setBusy(kind);
    setNote(null);
    try {
      if (kind === 'pdf') {
        const r = await buildReport(inspectionId);
        if (r !== 'cancelled') setNote({ ok: true, text: r === 'shared' ? 'Report ready to send.' : 'Report downloaded.' });
      } else {
        const { result, count } = await savePhotos(inspectionId, hiveName, state.selectedRecord?.timestamp as string | undefined);
        if (result !== 'cancelled') setNote({ ok: true, text: result === 'shared' ? `${count} photo(s) ready to save.` : `${count} photo(s) downloaded.` });
      }
    } catch (err) {
      const msg = (err as Error).message;
      setNote({ ok: false, text: msg || (kind === 'pdf' ? 'Could not create the report.' : 'Could not save the photos.') });
    } finally {
      setBusy(null);
    }
  };

  const option = (kind: 'pdf' | 'photos', Icon: typeof FileText, title: string, sub: string, first: boolean) => (
    <button
      type="button"
      disabled={!!busy}
      onClick={() => void run(kind)}
      className={`w-full flex items-center gap-4 rounded-2xl px-5 py-3.5 text-left disabled:opacity-60 ${first ? 'border-2 border-primary/40 bg-primary-wash' : ''}`}
    >
      {busy === kind ? <Spinner className="w-6 h-6" /> : <Icon size={20} className="text-primary shrink-0" />}
      <span>
        <span className="block text-[15px] font-bold text-text">{title}</span>
        <span className="block text-[11px] text-text-muted">{sub}</span>
      </span>
    </button>
  );

  return (
    <Overlay>
      <div className="fixed inset-0 z-[130] flex items-end sm:items-center justify-center bg-black/40 animate-fade-quick" onClick={() => !busy && onClose()}>
        <div role="dialog" aria-modal="true" aria-label="Export / Share" className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-white p-5 animate-sheet-in" style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }} onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-1 pb-4">
            <h2 className="text-lg font-black text-text">Export / Share</h2>
            <button type="button" aria-label="Close" disabled={!!busy} onClick={onClose} className="p-1 text-text-muted disabled:opacity-40">
              <X size={26} />
            </button>
          </div>
          <div className="space-y-2">
            {option('pdf', FileText, 'Inspection report (PDF)', 'Form, photos & notes — save or send to a mentor', true)}
            {option('photos', ImageDown, 'Save photos', 'Full-size JPEGs to your device', false)}
          </div>
          {note && <p className={`mt-4 rounded-2xl px-4 py-3 text-sm font-bold ${note.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>{note.text}</p>}
        </div>
      </div>
    </Overlay>
  );
}
