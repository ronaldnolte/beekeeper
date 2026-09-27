// Apiary and hive writes — SPEC B §5, §6, §9, §10, §20; SPEC E §1.

import { supabase } from './supabase';
import type { TablesInsert } from './database.types';

// ---------- apiaries ----------

export interface ApiaryInput {
  name: string;
  mode: 'postal' | 'coordinates';
  zip: string;
  lat: string;
  lng: string;
  notes: string;
}

/** Validation in the spec's order; returns the message to show, or null. */
export function validateApiary(v: ApiaryInput): string | null {
  if (v.mode === 'postal') return v.zip.trim() ? null : 'Postal code is required.';
  if (!v.lat.trim() || !v.lng.trim()) return 'Both Latitude and Longitude are required when using Coordinates.';
  const lat = Number(v.lat);
  const lng = Number(v.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return 'Coordinates must be valid numbers.';
  if (lat < -90 || lat > 90) return 'Latitude must be between -90 and 90 degrees.';
  if (lng < -180 || lng > 180) return 'Longitude must be between -180 and 180 degrees.';
  return null;
}

/** Saving in one mode clears the other; zip_code is NOT NULL, so coordinates mode writes "" (SCAR S-DATA-1/7). */
export function apiaryRow(v: ApiaryInput, userId: string) {
  const coords = v.mode === 'coordinates';
  return {
    name: v.name.trim(),
    zip_code: coords ? '' : v.zip.trim(),
    latitude: coords ? Number(v.lat) : null,
    longitude: coords ? Number(v.lng) : null,
    notes: v.notes.trim(),
    user_id: userId,
  };
}

export async function saveApiary(v: ApiaryInput, userId: string, id?: string) {
  const row = apiaryRow(v, userId);
  const { error } = id
    ? await supabase.from('apiaries').update(row).eq('id', id).eq('user_id', userId)
    : await supabase.from('apiaries').insert(row);
  if (error) throw new Error(error.message);
}

/** Continental-US warning (SPEC B §5): null when inside the box or not two valid numbers. */
export function coordinateWarning(latS: string, lngS: string): { kind: 'flip'; suggested: number } | { kind: 'outside' } | null {
  if (!latS.trim() || !lngS.trim()) return null;
  const lat = Number(latS);
  const lng = Number(lngS);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const inLat = lat >= 24 && lat <= 50;
  const inLng = (x: number) => x >= -125 && x <= -66;
  if (inLat && inLng(lng)) return null;
  if (lng > 0 && inLat && inLng(-lng)) return { kind: 'flip', suggested: -lng };
  return { kind: 'outside' };
}

/**
 * The client still deletes children explicitly, then verifies — row rules can refuse silently
 * (SPEC B §6, SCAR S-DATA-5). Storage files are NOT removed here (known gap).
 */
export async function deleteApiary(apiaryId: string, userId: string) {
  const { data: hives } = await supabase.from('hives').select('id').eq('apiary_id', apiaryId);
  const hiveIds = (hives ?? []).map(h => h.id);
  if (hiveIds.length) {
    for (const table of ['tasks', 'interventions', 'hive_snapshots', 'inspections', 'varroa_tests'] as const) {
      await supabase.from(table).delete().in('hive_id', hiveIds);
    }
    await supabase.from('hives').delete().eq('apiary_id', apiaryId);
    const { count } = await supabase.from('hives').select('id', { count: 'exact', head: true }).eq('apiary_id', apiaryId);
    if (count && count > 0) {
      throw new Error(`Failed to delete all hives. ${count} hive(s) could not be deleted. You may need to delete them manually first.`);
    }
  }
  await supabase.from('tasks').delete().eq('apiary_id', apiaryId);
  await supabase.from('weather_forecasts').delete().eq('apiary_id', apiaryId);
  const { error } = await supabase.from('apiaries').delete().eq('id', apiaryId).eq('user_id', userId);
  if (error) throw new Error(error.message);
  const { data: still } = await supabase.from('apiaries').select('id').eq('id', apiaryId).maybeSingle();
  if (still) {
    throw new Error(
      'Failed to delete apiary. The delete request completed, but the record still exists. This usually happens if your user account does not have deletion permissions (Row Level Security policy) on this apiary.',
    );
  }
}

// ---------- hives ----------

export interface TopBar {
  position: number;
  status: string;
}
export interface StackPart {
  id: string;
  type: string;
  frames?: number;
}

/** hives.bars / hive_snapshots.bars are text holding JSON; reads may be a string or an array. */
export function parseBars(raw: unknown): unknown[] | null {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const v = JSON.parse(raw);
      return Array.isArray(v) ? v : null;
    } catch {
      return null;
    }
  }
  return null;
}

export const defaultBars = (n: number): TopBar[] => Array.from({ length: n }, (_, i) => ({ position: i + 1, status: 'inactive' }));

/** Langstroth stack only when the type contains "langstroth" and not "long" (SPEC B §10). */
export const isLangstroth = (type: string | null | undefined) => {
  const t = (type ?? '').toLowerCase();
  return t.includes('langstroth') && !t.includes('long');
};

export interface HiveInput {
  name: string;
  apiaryId: string;
  /** Only present when the user tapped a type button (Ron, 2026-09-25: never rewrite a stored type). */
  type?: 'Top Bar' | 'Langstroth';
  notes: string;
  barCount: number;
}

export async function saveHive(v: HiveInput, id?: string) {
  if (id) {
    const row: { name: string; apiary_id: string; notes: string; type?: string } = { name: v.name.trim(), apiary_id: v.apiaryId, notes: v.notes };
    if (v.type) row.type = v.type;
    const { error } = await supabase.from('hives').update(row).eq('id', id); // editing never rewrites bars
    if (error) throw new Error(error.message);
    return;
  }
  const type = v.type ?? 'Top Bar';
  const row = {
    name: v.name.trim(),
    apiary_id: v.apiaryId,
    type,
    notes: v.notes,
    // The client sends an array; the text column stores its JSON text (SPEC B §20).
    ...(type === 'Top Bar' ? { bars: defaultBars(v.barCount) as unknown as string } : {}),
  } satisfies TablesInsert<'hives'>;
  const { error } = await supabase.from('hives').insert(row);
  if (error) throw new Error(error.message);
}

export async function deleteHive(hiveId: string) {
  for (const table of ['tasks', 'interventions', 'hive_snapshots', 'inspections', 'varroa_tests'] as const) {
    await supabase.from(table).delete().eq('hive_id', hiveId);
  }
  const { error } = await supabase.from('hives').delete().eq('id', hiveId);
  if (error) throw new Error(error.message);
}

/** Save the configuration to the hive, then log a snapshot (SPEC B §10a/§10b). */
export async function saveSnapshot(hiveId: string, bars: TopBar[] | StackPart[], kind: 'topbar' | 'stack') {
  const { error: e1 } = await supabase
    .from('hives')
    .update({ bars: bars as unknown as string })
    .eq('id', hiveId);
  if (e1) throw new Error(e1.message);
  const base = { hive_id: hiveId, bars: bars as unknown as string, timestamp: new Date().toISOString() };
  let row: TablesInsert<'hive_snapshots'> = base;
  if (kind === 'topbar') {
    const tb = bars as TopBar[];
    const count = (s: string) => tb.filter(b => b.status === s).length;
    row = {
      ...base,
      inactive_bar_count: count('inactive'),
      active_bar_count: count('active'),
      empty_bar_count: count('empty'),
      brood_bar_count: count('brood'),
      resource_bar_count: count('resource'),
      follower_board_position: tb.find(b => b.status === 'follower_board')?.position ?? null,
    };
  }
  const { error: e2 } = await supabase.from('hive_snapshots').insert(row);
  if (e2) throw new Error(e2.message);
}
