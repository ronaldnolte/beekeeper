/**
 * Build a single-inspection PDF report on the device. The document mirrors the
 * on-screen experience: header, the filled-in inspection form, then the same
 * chat-style feed of photos (with caption transcripts) and voice notes in the
 * order the user added them.
 *
 * Nothing is stored — the caller gets a Blob to share or save. jsPDF is
 * imported dynamically so it stays out of the main bundle until someone exports.
 */
import { fetchAttachments, type AttachmentWithUrls } from '../../data/inspectionAttachmentRepository';
import { imageForPdf } from '../../shared/image/toJpeg';
import {
  QUEEN_STATUS_OPTIONS,
  BROOD_PATTERN_OPTIONS,
  TEMPERAMENT_OPTIONS,
  STORES_OPTIONS,
} from './inspectionOptions';

export interface InspectionForPdf {
  id: string;
  timestamp: string;
  queen_status?: string;
  brood_pattern?: string;
  temperament?: string;
  honey_stores?: string;
  pollen_stores?: string;
  observations?: string;
}

export interface PdfContext {
  apiaryName?: string | null;
  hiveName?: string | null;
}

const labelOf = (options: { value: string; label: string }[], value?: string) =>
  options.find((o) => o.value === value)?.label ?? (value ? value : '—');

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

/** Fetch the app logo as a PNG data URL for the header. Returns null on failure. */
async function loadLogo(): Promise<string | null> {
  try {
    const res = await fetch('/logo.png');
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result as string);
      r.onerror = () => reject(new Error('logo'));
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function transcriptText(v: AttachmentWithUrls | undefined): string | null {
  if (!v) return null;
  if (v.transcript && v.transcript.trim()) return v.transcript.trim();
  if (v.transcript_status === 'failed' || v.audio_path) {
    return '[voice recording — transcript unavailable]';
  }
  return null;
}

/**
 * Render the report and return it as a PDF Blob plus a suggested filename.
 */
export async function buildInspectionPdf(
  inspection: InspectionForPdf,
  ctx: PdfContext = {}
): Promise<{ blob: Blob; filename: string }> {
  const [{ jsPDF }, attachments, logo] = await Promise.all([
    import('jspdf'),
    fetchAttachments(inspection.id),
    loadLogo(),
  ]);

  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentW = pageW - margin * 2;
  const bottomLimit = pageH - margin;

  const primary: [number, number, number] = [202, 138, 4]; // amber, matches app accent
  const text: [number, number, number] = [30, 30, 30];
  const muted: [number, number, number] = [110, 110, 110];

  let y = margin;

  const ensureSpace = (needed: number) => {
    if (y + needed > bottomLimit) {
      doc.addPage();
      y = margin;
    }
  };

  // ---- Header ---------------------------------------------------------------
  const logoSize = 16;
  if (logo) {
    try {
      doc.addImage(logo, 'PNG', margin, y, logoSize, logoSize);
    } catch {
      /* ignore a bad logo decode */
    }
  }
  const headerX = margin + (logo ? logoSize + 5 : 0);
  doc.setTextColor(...text);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('Inspection Report', headerX, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...muted);
  doc.text(formatDate(inspection.timestamp), headerX, y + 12);

  const place = [
    ctx.apiaryName ? `Apiary: ${ctx.apiaryName}` : null,
    ctx.hiveName ? `Hive: ${ctx.hiveName}` : null,
  ]
    .filter(Boolean)
    .join('   ·   ');
  if (place) doc.text(place, headerX, y + 17.5);

  y += Math.max(logoSize, 19) + 4;
  doc.setDrawColor(...primary);
  doc.setLineWidth(0.6);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  // ---- Form fields ----------------------------------------------------------
  const field = (label: string, value: string) => {
    ensureSpace(8);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...muted);
    doc.text(label.toUpperCase(), margin, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.setTextColor(...text);
    doc.text(value, margin + 42, y);
    y += 7;
  };

  field('Queen status', labelOf(QUEEN_STATUS_OPTIONS, inspection.queen_status));
  field('Brood pattern', labelOf(BROOD_PATTERN_OPTIONS, inspection.brood_pattern));
  field('Temperament', labelOf(TEMPERAMENT_OPTIONS, inspection.temperament));
  field('Honey stores', labelOf(STORES_OPTIONS, inspection.honey_stores));
  field('Pollen stores', labelOf(STORES_OPTIONS, inspection.pollen_stores));

  const notes = (inspection.observations ?? '').trim();
  if (notes) {
    ensureSpace(8);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...muted);
    doc.text('OBSERVATIONS', margin, y);
    y += 5.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.setTextColor(...text);
    const lines = doc.splitTextToSize(notes, contentW);
    for (const line of lines) {
      ensureSpace(6);
      doc.text(line, margin, y);
      y += 5.5;
    }
  }

  // ---- Attachment feed ------------------------------------------------------
  const topLevel = attachments.filter((a) => a.kind === 'photo' || !a.parent_id);
  const captionFor = (photoId: string) =>
    attachments.find((a) => a.kind === 'voice_note' && a.parent_id === photoId);

  if (topLevel.length > 0) {
    y += 4;
    ensureSpace(10);
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageW - margin, y);
    y += 7;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...text);
    doc.text('Photos & Notes', margin, y);
    y += 7;
  }

  const addCaption = (label: string, body: string | null) => {
    if (!body) return;
    const lines = doc.splitTextToSize(`${label}${body}`, contentW);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(11);
    doc.setTextColor(...muted);
    for (const line of lines) {
      ensureSpace(6);
      doc.text(line, margin, y);
      y += 5.2;
    }
    y += 2;
  };

  // Process images one at a time (decode → embed → release) to keep memory flat.
  for (const item of topLevel) {
    if (item.kind === 'photo') {
      if (item.fullUrl) {
        try {
          const img = await imageForPdf(item.fullUrl);
          const dispW = Math.min(contentW, 135);
          let drawW = dispW;
          let drawH = (img.height / img.width) * drawW;
          const maxH = pageH - margin * 2 - 10;
          if (drawH > maxH) {
            drawH = maxH;
            drawW = (img.width / img.height) * drawH;
          }
          ensureSpace(drawH + 3);
          doc.addImage(img.dataUrl, 'JPEG', margin, y, drawW, drawH);
          y += drawH + 3;
        } catch {
          ensureSpace(6);
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(11);
          doc.setTextColor(...muted);
          doc.text('[photo could not be loaded]', margin, y);
          y += 6;
        }
      }
      addCaption('Caption: ', transcriptText(captionFor(item.id)));
      y += 2;
    } else {
      // Standalone voice note
      addCaption('Voice note: ', transcriptText(item));
    }
  }

  const datePart = new Date(inspection.timestamp).toISOString().split('T')[0];
  const hivePart = (ctx.hiveName ?? 'hive').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  const filename = `inspection-${hivePart}-${datePart}.pdf`;

  return { blob: doc.output('blob'), filename };
}
