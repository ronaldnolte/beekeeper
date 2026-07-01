import React, { useState } from 'react';
import { Share2, FileText, ImageDown, X, Loader2, Check } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { buildInspectionPdf, type InspectionForPdf } from './exportInspectionPdf';
import { exportInspectionPhotos } from './exportPhotos';
import { shareFile } from '../../shared/share/shareFile';

/**
 * Export / Share entry point for a saved inspection. Renders a trigger button
 * and a small action sheet offering the PDF report or a photo save. Everything
 * is generated on the device on demand — nothing is stored.
 */
export const ExportInspectionSheet: React.FC<{ inspection: InspectionForPdf; hiveId?: string }> = ({
  inspection,
  hiveId,
}) => {
  const { hivesList, apiariesList, selectedHiveName, selectedApiaryName } = useAppStore();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<null | 'pdf' | 'photos'>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Prefer a fresh lookup by hive id; fall back to the active navigation names.
  const hive = hivesList.find((h: any) => h.id === hiveId);
  const apiary = apiariesList.find((a: any) => a.id === hive?.apiary_id);
  const hiveName = hive?.name ?? selectedHiveName ?? null;
  const apiaryName = apiary?.name ?? selectedApiaryName ?? null;

  const close = () => {
    if (busy) return;
    setOpen(false);
    setNote(null);
    setError(null);
  };

  const handlePdf = async () => {
    setBusy('pdf');
    setError(null);
    setNote(null);
    try {
      const { blob, filename } = await buildInspectionPdf(inspection, { hiveName, apiaryName });
      const outcome = await shareFile({ blob, filename }, { title: 'Inspection Report' });
      setNote(outcome === 'downloaded' ? 'Report downloaded.' : outcome === 'shared' ? 'Report ready to send.' : null);
    } catch (e: any) {
      setError(e?.message ?? 'Could not create the report.');
    } finally {
      setBusy(null);
    }
  };

  const handlePhotos = async () => {
    setBusy('photos');
    setError(null);
    setNote(null);
    try {
      const { outcome, count } = await exportInspectionPhotos(inspection.id, {
        hiveName,
        timestamp: inspection.timestamp,
      });
      setNote(
        outcome === 'downloaded'
          ? `${count} photo${count === 1 ? '' : 's'} downloaded.`
          : outcome === 'shared'
            ? `${count} photo${count === 1 ? '' : 's'} ready to save.`
            : null
      );
    } catch (e: any) {
      setError(e?.message ?? 'Could not save the photos.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full max-w-2xl card p-2.5 flex items-center justify-center gap-2 font-black text-sm text-[var(--color-text)] border-2 border-[var(--color-card-border)] active:scale-[0.99] transition-transform"
      >
        <Share2 size={18} /> Export / Share
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={close}>
          <div
            className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-3xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-lg text-[var(--color-text)]">Export / Share</h3>
              <button
                onClick={close}
                disabled={!!busy}
                className="w-9 h-9 rounded-full bg-[var(--color-input-bg)] flex items-center justify-center text-[var(--color-text-muted)] disabled:opacity-50"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            {error && (
              <div className="mb-3 bg-red-500/10 border border-red-500/40 text-red-600 dark:text-red-400 rounded-xl px-3 py-2 text-sm font-medium">
                {error}
              </div>
            )}
            {note && (
              <div className="mb-3 bg-green-500/10 border border-green-500/40 text-green-700 dark:text-green-400 rounded-xl px-3 py-2 text-sm font-medium flex items-center gap-2">
                <Check size={16} /> {note}
              </div>
            )}

            <div className="space-y-2.5">
              <button
                onClick={handlePdf}
                disabled={!!busy}
                className="w-full flex items-center gap-3 p-4 rounded-2xl bg-[var(--color-primary)]/10 border-2 border-[var(--color-primary)]/30 text-[var(--color-text)] font-bold active:scale-[0.99] disabled:opacity-50"
              >
                {busy === 'pdf' ? (
                  <Loader2 size={22} className="animate-spin text-[var(--color-primary)]" />
                ) : (
                  <FileText size={22} className="text-[var(--color-primary)]" />
                )}
                <span className="flex-1 text-left">
                  Inspection report (PDF)
                  <span className="block text-xs font-medium text-[var(--color-text-muted)]">
                    Form, photos &amp; notes — save or send to a mentor
                  </span>
                </span>
              </button>

              <button
                onClick={handlePhotos}
                disabled={!!busy}
                className="w-full flex items-center gap-3 p-4 rounded-2xl bg-[var(--color-input-bg)] border-2 border-[var(--color-card-border)] text-[var(--color-text)] font-bold active:scale-[0.99] disabled:opacity-50"
              >
                {busy === 'photos' ? (
                  <Loader2 size={22} className="animate-spin text-[var(--color-primary)]" />
                ) : (
                  <ImageDown size={22} className="text-[var(--color-primary)]" />
                )}
                <span className="flex-1 text-left">
                  Save photos
                  <span className="block text-xs font-medium text-[var(--color-text-muted)]">
                    Full-size JPEGs to your device
                  </span>
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
