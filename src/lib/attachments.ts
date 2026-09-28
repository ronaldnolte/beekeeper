// Inspection photos and voice notes — SPEC B §15, SPEC E §1/§5.

import { supabase } from './supabase';
import { apiBase } from './platform';
import type { Tables } from './database.types';

export type Attachment = Tables<'inspection_attachments'>;
export const BUCKET = 'inspection-images';
export const PHOTO_CAP = 12;

export async function listAttachments(inspectionId: string): Promise<Attachment[]> {
  const { data, error } = await supabase
    .from('inspection_attachments')
    .select('*')
    .eq('inspection_id', inspectionId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Signed URLs, valid for one hour, for every stored path. */
export async function signedUrls(paths: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))];
  if (!unique.length) return {};
  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(unique, 3600);
  const out: Record<string, string> = {};
  for (const d of data ?? []) if (d.path && d.signedUrl) out[d.path] = d.signedUrl;
  return out;
}

export const filesOf = (a: Pick<Attachment, 'storage_path' | 'thumb_path' | 'audio_path'>) => [a.storage_path, a.thumb_path, a.audio_path].filter((p): p is string => !!p);

/** Remove the item's storage files, then its row (a photo's caption row cascades). */
export async function deleteAttachment(a: Attachment) {
  const files = filesOf(a);
  if (files.length) await supabase.storage.from(BUCKET).remove(files);
  const { error } = await supabase.from('inspection_attachments').delete().eq('id', a.id);
  if (error) throw new Error(error.message);
}

const uuid = () => crypto.randomUUID();

export async function uploadPhoto(opts: {
  userId: string;
  inspectionId: string;
  sortOrder: number;
  full: Blob;
  thumb: Blob;
  width: number;
  height: number;
}) {
  const base = `${opts.userId}/${opts.inspectionId}/${uuid()}`;
  const fullPath = `${base}.webp`;
  const thumbPath = `${base}_thumb.webp`;
  const store = supabase.storage.from(BUCKET);
  const up1 = await store.upload(fullPath, opts.full, { contentType: 'image/webp', upsert: false });
  if (up1.error) throw new Error(up1.error.message);
  const up2 = await store.upload(thumbPath, opts.thumb, { contentType: 'image/webp', upsert: false });
  if (up2.error) {
    await store.remove([fullPath]);
    throw new Error(up2.error.message);
  }
  const { error } = await supabase.from('inspection_attachments').insert({
    inspection_id: opts.inspectionId,
    owner: opts.userId,
    kind: 'photo',
    sort_order: opts.sortOrder,
    storage_path: fullPath,
    thumb_path: thumbPath,
    width: opts.width,
    height: opts.height,
    byte_size: opts.full.size,
  });
  if (error) {
    await store.remove([fullPath, thumbPath]);
    throw new Error(error.message);
  }
}

const extensionFor = (mime: string) => (mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm');

/** Upload the clip, insert a pending row, then transcribe in the background. */
export async function saveVoiceNote(opts: { userId: string; inspectionId: string; sortOrder: number; parentId: string | null; clip: Blob; onDone: () => void }) {
  const mime = opts.clip.type || 'audio/webm';
  const path = `${opts.userId}/${opts.inspectionId}/${uuid()}.${extensionFor(mime)}`;
  const up = await supabase.storage.from(BUCKET).upload(path, opts.clip, { contentType: mime, upsert: false });
  if (up.error) throw new Error(up.error.message);
  const { data: row, error } = await supabase
    .from('inspection_attachments')
    .insert({
      inspection_id: opts.inspectionId,
      owner: opts.userId,
      kind: 'voice_note',
      parent_id: opts.parentId,
      sort_order: opts.sortOrder,
      audio_path: path,
      transcript_status: 'pending',
    })
    .select('id')
    .single();
  if (error || !row) {
    await supabase.storage.from(BUCKET).remove([path]);
    throw new Error(error?.message ?? 'insert failed');
  }
  void transcribe(row.id, opts.clip, mime, path).finally(opts.onDone);
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = '';
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Same origin on the web: it writes to the database of the deployment it runs on (SCAR S-API-2). */
async function transcribe(attachmentId: string, clip: Blob, mimeType: string, audioPath: string) {
  try {
    const { data } = await supabase.auth.getSession();
    const res = await fetch(`${apiBase()}/api/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attachmentId, audioBase64: await blobToBase64(clip), mimeType, audioPath, sessionToken: data.session?.access_token }),
    });
    if (!res.ok) throw new Error(`transcribe ${res.status}`);
  } catch (err) {
    console.warn('[transcribe]', err);
    // Keep the audio for playback; mark the row failed.
    await supabase.from('inspection_attachments').update({ transcript_status: 'failed' }).eq('id', attachmentId);
  }
}

export async function setTranscript(id: string, text: string) {
  const { error } = await supabase.from('inspection_attachments').update({ transcript: text.trim(), transcript_status: 'done' }).eq('id', id);
  if (error) throw new Error(error.message);
}
