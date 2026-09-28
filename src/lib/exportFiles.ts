// Export / Share — SPEC B §16: on-device PDF report and full-size JPEG photos.

import { supabase } from './supabase';
import { BUCKET, listAttachments, type Attachment } from './attachments';
import { toJpeg } from './imagePipeline';
import { BROOD, QUEEN, STORES, TEMPERAMENT, labelOf } from './inspections';
import { utcDay } from './recordDates';

type Delivery = 'shared' | 'downloaded' | 'cancelled';

/** iPhone/iPad/iPod, or an iPad reporting as a Mac with touch. */
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Share sheet only on iOS when files can be shared; everywhere else a direct download (SCAR S-INSP-14). */
async function deliver(files: { blob: Blob; name: string }[], title: string): Promise<Delivery> {
  const asFiles = files.map(f => new File([f.blob], f.name, { type: f.blob.type }));
  if (isIOS() && navigator.canShare?.({ files: asFiles })) {
    try {
      await navigator.share({ files: asFiles, title });
      return 'shared';
    } catch (err) {
      if ((err as Error).name === 'AbortError') return 'cancelled';
      throw err;
    }
  }
  for (const f of files) {
    download(f.blob, f.name);
    await new Promise(r => setTimeout(r, 250)); // each file separately
  }
  return 'downloaded';
}

const slug = (name: string | null) => (name ?? '').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
const photoSlug = (name: string | null) => slug(name).replace(/^-+|-+$/g, '') || 'hive';

async function fetchStored(path: string): Promise<Blob> {
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !data) throw new Error(error?.message ?? 'download failed');
  return data;
}

// ---------- photos ----------

export async function savePhotos(inspectionId: string, hiveName: string | null, timestamp: string | undefined): Promise<{ result: Delivery; count: number }> {
  const photos = (await listAttachments(inspectionId)).filter(a => a.kind === 'photo' && a.storage_path);
  if (!photos.length) throw new Error('This inspection has no photos to save.');
  const date = utcDay(timestamp);
  const files: { blob: Blob; name: string }[] = [];
  for (let i = 0; i < photos.length; i++) {
    // One at a time to keep memory flat on low-end phones.
    const { blob } = await toJpeg(await fetchStored(photos[i].storage_path!), 4096, 0.92);
    files.push({ blob, name: `photo-${photoSlug(hiveName)}-${date}-${i + 1}.jpg` });
  }
  return { result: await deliver(files, 'Inspection photos'), count: files.length };
}

export async function saveSinglePhoto(a: Attachment, hiveName: string | null, timestamp: string | undefined) {
  if (!a.storage_path) return;
  const { blob } = await toJpeg(await fetchStored(a.storage_path), 4096, 0.92);
  await deliver([{ blob, name: `photo-${photoSlug(hiveName)}-${utcDay(timestamp)}.jpg` }], 'Inspection photo');
}

// ---------- PDF ----------

async function logoDataUrl(): Promise<string | null> {
  try {
    const blob = await (await fetch('/logo.png')).blob();
    return await new Promise(res => {
      const r = new FileReader();
      r.onload = () => res(r.result as string);
      r.onerror = () => res(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function transcriptText(a: Attachment): string | null {
  if (a.transcript?.trim()) return a.transcript.trim();
  if (a.transcript_status === 'failed' || a.audio_path) return '[voice recording — transcript unavailable]';
  return null;
}

export async function buildReport(inspectionId: string): Promise<Delivery> {
  const { jsPDF } = await import('jspdf'); // loaded only when needed (SCAR S-INSP-13)
  const { data: insp, error } = await supabase.from('inspections').select('*').eq('id', inspectionId).single();
  if (error || !insp) throw new Error('Could not create the report.');
  const { data: hive } = await supabase.from('hives').select('name, apiary_id').eq('id', insp.hive_id).maybeSingle();
  const { data: apiary } = hive ? await supabase.from('apiaries').select('name').eq('id', hive.apiary_id).maybeSingle() : { data: null };
  const items = await listAttachments(inspectionId);

  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  const M = 15;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - 2 * M;
  let y = M;
  const ensure = (h: number) => {
    if (y + h > pageH - M) {
      doc.addPage();
      y = M;
    }
  };

  // Header
  const logo = await logoDataUrl();
  if (logo) doc.addImage(logo, 'PNG', M, y, 16, 16);
  const x = M + 21;
  doc.setFont('helvetica', 'bold').setFontSize(20).setTextColor(33, 33, 33);
  doc.text('Inspection Report', x, y + 6);
  doc.setFont('helvetica', 'normal').setFontSize(11).setTextColor(120, 120, 120);
  doc.text(new Date(insp.timestamp).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }), x, y + 12);
  if (apiary?.name || hive?.name) doc.text(`Apiary: ${apiary?.name ?? '—'}   ·   Hive: ${hive?.name ?? '—'}`, x, y + 17.5);
  y += 21;
  doc.setDrawColor(202, 138, 4).setLineWidth(0.6).line(M, y, pageW - M, y);
  y += 8;

  // Fields
  const fields: [string, string][] = [
    ['Queen status', labelOf(QUEEN, insp.queen_status)],
    ['Brood pattern', labelOf(BROOD, insp.brood_pattern)],
    ['Temperament', labelOf(TEMPERAMENT, insp.temperament)],
    ['Honey stores', labelOf(STORES, insp.honey_stores)],
    ['Pollen stores', labelOf(STORES, insp.pollen_stores)],
  ];
  for (const [label, value] of fields) {
    doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(120, 120, 120).text(label.toUpperCase(), M, y);
    doc.setFont('helvetica', 'normal').setFontSize(12).setTextColor(33, 33, 33).text(value, M + 42, y);
    y += 7;
  }

  if (insp.observations?.trim()) {
    y += 3;
    ensure(12);
    doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(120, 120, 120).text('OBSERVATIONS', M, y);
    y += 6;
    doc.setFont('helvetica', 'normal').setFontSize(11).setTextColor(33, 33, 33);
    for (const line of doc.splitTextToSize(insp.observations, contentW) as string[]) {
      ensure(5.5);
      doc.text(line, M, y);
      y += 5.5;
    }
  }

  if (items.length) {
    y += 4;
    ensure(14);
    doc.setDrawColor(220, 220, 220).setLineWidth(0.3).line(M, y, pageW - M, y);
    y += 7;
    doc.setFont('helvetica', 'bold').setFontSize(13).setTextColor(33, 33, 33).text('Photos & Notes', M, y);
    y += 7;

    const writeNote = (prefix: string, text: string, italicGrey: boolean) => {
      doc.setFont('helvetica', italicGrey ? 'italic' : 'normal').setFontSize(11).setTextColor(italicGrey ? 110 : 33, italicGrey ? 110 : 33, italicGrey ? 110 : 33);
      for (const line of doc.splitTextToSize(`${prefix}${text}`, contentW) as string[]) {
        ensure(5.5);
        doc.text(line, M, y);
        y += 5.5;
      }
      y += 2;
    };

    for (const a of items.filter(i => !i.parent_id)) {
      if (a.kind === 'photo' && a.storage_path) {
        try {
          // Images one at a time, re-encoded as JPEG (the PDF library cannot embed WebP reliably).
          const jpg = await toJpeg(await fetchStored(a.storage_path), 1400, 0.85);
          let w = Math.min(contentW, 135);
          let h = (w * jpg.h) / jpg.w;
          const maxH = pageH - 2 * M;
          if (h > maxH) {
            h = maxH;
            w = (h * jpg.w) / jpg.h;
          }
          ensure(h + 2);
          doc.addImage(jpg.dataUrl, 'JPEG', M, y, w, h);
          y += h + 3;
        } catch {
          writeNote('', '[photo could not be loaded]', true);
        }
        const caption = items.find(i => i.parent_id === a.id);
        const t = caption && transcriptText(caption);
        if (t) writeNote('Caption: ', t, true);
      } else if (a.kind === 'voice_note') {
        const t = transcriptText(a);
        if (t) writeNote('Voice note: ', t, false);
      }
    }
  }

  const name = `inspection-${slug(hive?.name ?? null) || 'hive'}-${utcDay(insp.timestamp)}.pdf`;
  return deliver([{ blob: doc.output('blob'), name }], 'Inspection Report');
}
