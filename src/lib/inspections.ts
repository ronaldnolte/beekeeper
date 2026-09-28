// Inspection writes — SPEC B §14.

import { supabase } from './supabase';
import { BUCKET, filesOf } from './attachments';
import type { Tables } from './database.types';

export type Inspection = Tables<'inspections'>;

export const QUEEN = [
  ['Seen', 'seen'],
  ['Eggs', 'eggs_present'],
  ['Larvae', 'larvae_present'],
  ['Capped', 'capped_brood'],
  ['Virgin', 'virgin'],
  ['NO QUEEN', 'no_queen'],
  ['Q. Cells', 'queen_cells'],
] as const;
export const BROOD = [
  ['Solid', 'excellent'],
  ['Good', 'good'],
  ['Spotty', 'spotty'],
  ['Poor', 'poor'],
] as const;
export const TEMPERAMENT = [
  ['Calm', 'calm'],
  ['Moderate', 'moderate'],
  ['Defensive', 'defensive'],
  ['Aggressive', 'aggressive'],
] as const;
export const STORES = [
  ['None', 'none'],
  ['Some', 'low'],
  ['Half', 'adequate'],
  ['Full', 'abundant'],
] as const;

export interface InspectionFields {
  queen_status: string;
  brood_pattern: string | null;
  temperament: string | null;
  honey_stores: string | null;
  pollen_stores: string | null;
  observations: string | null;
}

export const DEFAULTS: InspectionFields = {
  queen_status: 'seen',
  brood_pattern: 'good',
  temperament: 'moderate',
  honey_stores: 'adequate',
  pollen_stores: 'adequate',
  observations: '',
};

/** "+ Add Inspection" creates the record at once so attachments have an owner (SCAR S-INSP-2). */
export async function startInspection(hiveId: string): Promise<Inspection> {
  const { data, error } = await supabase
    .from('inspections')
    .insert({ hive_id: hiveId, timestamp: new Date().toISOString(), ...DEFAULTS })
    .select('*')
    .single();
  if (error || !data) throw new Error(error?.message ?? 'no row returned');
  return data;
}

export async function saveInspection(id: string | null, hiveId: string, timestamp: string, fields: InspectionFields) {
  const row = { timestamp, ...fields };
  const { error } = id ? await supabase.from('inspections').update(row).eq('id', id) : await supabase.from('inspections').insert({ ...row, hive_id: hiveId });
  if (error) throw new Error(error.message);
}

/** Remove every attachment's files first, then the row (attachment rows cascade). */
export async function deleteInspection(id: string) {
  const { data: atts } = await supabase.from('inspection_attachments').select('storage_path, thumb_path, audio_path').eq('inspection_id', id);
  const files = (atts ?? []).flatMap(filesOf);
  if (files.length) await supabase.storage.from(BUCKET).remove(files);
  const { error } = await supabase.from('inspections').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export const labelOf = (options: readonly (readonly [string, string])[], value: string | null | undefined) =>
  options.find(([, v]) => v === value)?.[0] ?? value ?? '—';
