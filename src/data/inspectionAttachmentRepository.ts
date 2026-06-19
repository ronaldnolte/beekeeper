import { supabase } from './supabase';
import { compressImage } from '../shared/image/compress';

const BUCKET = 'inspection-images';
/** How long display URLs stay valid (seconds). 1 hour covers a view session. */
const SIGNED_URL_TTL = 60 * 60;

export type AttachmentKind = 'photo' | 'voice_note';
export type TranscriptStatus = 'none' | 'pending' | 'done' | 'failed';

export interface InspectionAttachment {
  id: string;
  inspection_id: string;
  owner: string;
  kind: AttachmentKind;
  /** For a photo's caption: the photo attachment's id. Null for standalone items. */
  parent_id: string | null;
  sort_order: number;
  // photo fields
  storage_path: string | null;
  thumb_path: string | null;
  width: number | null;
  height: number | null;
  byte_size: number | null;
  // voice fields (audio_path is scaffolding — cleared on approval)
  audio_path: string | null;
  transcript: string | null;
  transcript_status: TranscriptStatus;
  created_at: string;
}

export interface AttachmentWithUrls extends InspectionAttachment {
  thumbUrl: string | null;
  fullUrl: string | null;
  audioUrl: string | null;
}

async function currentOwnerId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('You must be signed in to add attachments.');
  return data.user.id;
}

/**
 * Compress a picked/captured photo and store it as a 'photo' attachment.
 * Full + thumbnail go to the private bucket under {owner}/{inspection_id}/.
 */
export async function uploadPhoto(
  inspectionId: string,
  file: File,
  sortOrder = 0
): Promise<InspectionAttachment> {
  const owner = await currentOwnerId();
  const { full, thumb, width, height, mimeType } = await compressImage(file);

  const key = crypto.randomUUID();
  const base = `${owner}/${inspectionId}/${key}`;
  const storage_path = `${base}.webp`;
  const thumb_path = `${base}_thumb.webp`;

  const uploadOpts = { contentType: mimeType, upsert: false };
  const [fullRes, thumbRes] = await Promise.all([
    supabase.storage.from(BUCKET).upload(storage_path, full, uploadOpts),
    supabase.storage.from(BUCKET).upload(thumb_path, thumb, uploadOpts),
  ]);
  if (fullRes.error) throw fullRes.error;
  if (thumbRes.error) {
    await supabase.storage.from(BUCKET).remove([storage_path]);
    throw thumbRes.error;
  }

  const { data, error } = await supabase
    .from('inspection_attachments')
    .insert({
      inspection_id: inspectionId,
      owner,
      kind: 'photo',
      sort_order: sortOrder,
      storage_path,
      thumb_path,
      width,
      height,
      byte_size: full.size,
    })
    .select()
    .single();

  if (error) {
    await supabase.storage.from(BUCKET).remove([storage_path, thumb_path]);
    throw error;
  }
  return data as InspectionAttachment;
}

/**
 * Store a recorded voice clip as a 'voice_note' attachment. Pass `parentId` to
 * make it a caption on a photo; omit it for a standalone note. Marked
 * transcript_status='pending' so the UI shows a "converting…" placeholder until
 * the AI transcription fills in `transcript`.
 */
export async function uploadVoiceNote(
  inspectionId: string,
  audio: Blob,
  opts: { parentId?: string; sortOrder?: number } = {}
): Promise<InspectionAttachment> {
  const owner = await currentOwnerId();

  const ext = audio.type.includes('mp4') || audio.type.includes('m4a') ? 'm4a'
    : audio.type.includes('ogg') ? 'ogg'
    : 'webm';
  const key = crypto.randomUUID();
  const audio_path = `${owner}/${inspectionId}/${key}.${ext}`;

  const up = await supabase.storage
    .from(BUCKET)
    .upload(audio_path, audio, { contentType: audio.type || 'audio/webm', upsert: false });
  if (up.error) throw up.error;

  const { data, error } = await supabase
    .from('inspection_attachments')
    .insert({
      inspection_id: inspectionId,
      owner,
      kind: 'voice_note',
      parent_id: opts.parentId ?? null,
      sort_order: opts.sortOrder ?? 0,
      audio_path,
      transcript_status: 'pending',
    })
    .select()
    .single();

  if (error) {
    await supabase.storage.from(BUCKET).remove([audio_path]);
    throw error;
  }
  return data as InspectionAttachment;
}

/** Fetch all attachments for an inspection, ordered, with short-lived signed URLs. */
export async function fetchAttachments(inspectionId: string): Promise<AttachmentWithUrls[]> {
  const { data, error } = await supabase
    .from('inspection_attachments')
    .select('*')
    .eq('inspection_id', inspectionId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;

  const rows = (data ?? []) as InspectionAttachment[];
  if (rows.length === 0) return [];

  const sign = async (paths: (string | null)[]) => {
    const real = paths.filter((p): p is string => !!p);
    if (real.length === 0) return new Map<string, string>();
    const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrls(real, SIGNED_URL_TTL);
    const map = new Map<string, string>();
    (signed ?? []).forEach((s) => {
      if (s.path && s.signedUrl) map.set(s.path, s.signedUrl);
    });
    return map;
  };

  const [thumbMap, fullMap, audioMap] = await Promise.all([
    sign(rows.map((r) => r.thumb_path)),
    sign(rows.map((r) => r.storage_path)),
    sign(rows.map((r) => r.audio_path)),
  ]);

  return rows.map((row) => ({
    ...row,
    thumbUrl: row.thumb_path ? thumbMap.get(row.thumb_path) ?? null : null,
    fullUrl: row.storage_path ? fullMap.get(row.storage_path) ?? null : null,
    audioUrl: row.audio_path ? audioMap.get(row.audio_path) ?? null : null,
  }));
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Strip the "data:<mime>;base64," prefix — the API wants raw base64.
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(new Error('Could not read the recording.'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Send a voice note's audio to the Gemini transcription endpoint, which writes
 * the text back to the row. On failure, marks the row 'failed' (audio is kept
 * so the user can still play it). Pass the same blob that was uploaded.
 */
export async function requestTranscription(attachmentId: string, audio: Blob): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  const audioBase64 = await blobToBase64(audio);
  let res: Response;
  try {
    res = await fetch('/api/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        attachmentId,
        audioBase64,
        mimeType: audio.type,
        sessionToken: session?.access_token,
      }),
    });
  } catch (e) {
    await updateTranscript(attachmentId, null, 'failed');
    throw new Error('Could not reach the transcription service.');
  }
  if (!res.ok) {
    await updateTranscript(attachmentId, null, 'failed');
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Transcription failed.');
  }
}

/** Record the result of AI transcription on a voice note. */
export async function updateTranscript(
  id: string,
  transcript: string | null,
  status: TranscriptStatus
): Promise<void> {
  const { error } = await supabase
    .from('inspection_attachments')
    .update({ transcript, transcript_status: status })
    .eq('id', id);
  if (error) throw error;
}

/** Delete one attachment: its storage objects (any kind) then the row (children cascade). */
export async function deleteAttachment(att: InspectionAttachment): Promise<void> {
  const paths = [att.storage_path, att.thumb_path, att.audio_path].filter(
    (p): p is string => !!p
  );
  if (paths.length > 0) {
    const { error: storageErr } = await supabase.storage.from(BUCKET).remove(paths);
    if (storageErr) throw storageErr;
  }
  const { error } = await supabase.from('inspection_attachments').delete().eq('id', att.id);
  if (error) throw error;
}

/**
 * On approval, the now-redundant audio is discarded (transcript is the keeper).
 * Removes audio objects for the inspection's voice notes and clears audio_path.
 */
export async function clearAudioForInspection(inspectionId: string): Promise<void> {
  const { data, error } = await supabase
    .from('inspection_attachments')
    .select('id, audio_path')
    .eq('inspection_id', inspectionId)
    .eq('kind', 'voice_note')
    .not('audio_path', 'is', null);
  if (error) throw error;

  const rows = (data ?? []) as { id: string; audio_path: string }[];
  if (rows.length === 0) return;

  const { error: storageErr } = await supabase.storage
    .from(BUCKET)
    .remove(rows.map((r) => r.audio_path));
  if (storageErr) throw storageErr;

  const { error: updErr } = await supabase
    .from('inspection_attachments')
    .update({ audio_path: null })
    .in('id', rows.map((r) => r.id));
  if (updErr) throw updErr;
}
