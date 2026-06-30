/**
 * "Save photos" — hand the user their inspection photos as standard JPEGs at the
 * stored resolution, so they can keep them or move to another app. Format is the
 * only change from storage (WebP → JPEG for universal compatibility); the pixel
 * size is whatever was stored.
 */
import { fetchAttachments } from '../../data/inspectionAttachmentRepository';
import { imageForExport } from '../../shared/image/toJpeg';
import { shareFiles, shareFile, type ShareableFile, type ShareOutcome } from '../../shared/share/shareFile';

function slug(s: string | null | undefined, fallback: string): string {
  const cleaned = (s ?? '').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
  return cleaned || fallback;
}

/** Convert + share/save every photo on an inspection. Throws if there are none. */
export async function exportInspectionPhotos(
  inspectionId: string,
  ctx: { hiveName?: string | null; timestamp?: string } = {}
): Promise<{ outcome: ShareOutcome; count: number }> {
  const attachments = await fetchAttachments(inspectionId);
  const photos = attachments.filter((a) => a.kind === 'photo' && a.fullUrl);
  if (photos.length === 0) throw new Error('This inspection has no photos to save.');

  const hivePart = slug(ctx.hiveName, 'hive');
  const datePart = ctx.timestamp ? new Date(ctx.timestamp).toISOString().split('T')[0] : 'photo';

  const files: ShareableFile[] = [];
  let n = 1;
  for (const p of photos) {
    const img = await imageForExport(p.fullUrl!);
    files.push({ blob: img.blob, filename: `photo-${hivePart}-${datePart}-${n}.jpg` });
    n += 1;
  }

  const outcome = await shareFiles(files, { title: 'Inspection photos' });
  return { outcome, count: files.length };
}

/** Save/share a single photo (used from the lightbox). */
export async function exportSinglePhoto(fullUrl: string, filename: string): Promise<ShareOutcome> {
  const img = await imageForExport(fullUrl);
  return shareFile({ blob: img.blob, filename }, { title: 'Inspection photo' });
}
