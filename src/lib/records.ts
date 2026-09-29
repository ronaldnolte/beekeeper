// Intervention, varroa test and task writes — SPEC B §2, §3, §17, §18.

import { supabase } from './supabase';
import type { Tables } from './database.types';
import { seasonalThreshold } from '../../shared/varroa';

export type Intervention = Tables<'interventions'>;
export type VarroaTest = Tables<'varroa_tests'>;
export type Task = Tables<'tasks'>;

// ---------- interventions ----------

export const INTERVENTION_TYPES = [
  ['Feeding', 'feeding'],
  ['Treatment', 'treatment'],
  ['Manipulation', 'manipulation'],
  ['Cross Comb', 'cross_comb_fix'],
  ['Requeen', 'requeen'],
  ['Harvest', 'honey_harvest'],
  ['Other', 'other'],
] as const;

export async function saveIntervention(id: string | null, hiveId: string, fields: { timestamp: string; type: string; description: string }) {
  const row = { hive_id: hiveId, ...fields };
  const { error } = id ? await supabase.from('interventions').update(row).eq('id', id) : await supabase.from('interventions').insert(row);
  if (error) throw new Error(error.message);
}

export async function deleteIntervention(id: string) {
  const { error } = await supabase.from('interventions').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ---------- varroa ----------

/** Threshold for a test date "YYYY-MM-DD" (the month of the chosen day). */
export const thresholdForDay = (day: string) => seasonalThreshold(Number(day.slice(5, 7)));

export async function listVarroa(hiveId: string): Promise<VarroaTest[]> {
  const { data, error } = await supabase.from('varroa_tests').select('*').eq('hive_id', hiveId).order('tested_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Requeen interventions for the season chart. */
export async function listRequeens(hiveId: string): Promise<string[]> {
  const { data } = await supabase.from('interventions').select('timestamp').eq('hive_id', hiveId).eq('type', 'requeen');
  return (data ?? []).map(r => r.timestamp);
}

/** The database computes mite_pct itself; never send it. */
export async function saveVarroa(
  id: string | null,
  row: { hive_id: string; user_id: string; tested_at: string; bee_count: number; mite_count: number; threshold: number; notes: string | null },
) {
  const { error } = id ? await supabase.from('varroa_tests').update(row).eq('id', id) : await supabase.from('varroa_tests').insert(row);
  if (error) throw new Error(error.message);
}

export async function deleteVarroa(id: string) {
  const { error } = await supabase.from('varroa_tests').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ---------- tasks ----------

export type TaskScope = 'hive' | 'apiary' | 'user';

/** New task: hive if it has one, else apiary, else user. Edit keeps the stored scope. */
export function taskScope(hiveId: string | null, apiaryId: string | null, stored?: string | null): string {
  if (stored) return stored;
  return hiveId ? 'hive' : apiaryId ? 'apiary' : 'user';
}

/** Due dates are the chosen day at 00:00 UTC, or null when cleared. */
export const dueDateIso = (day: string) => (day ? new Date(`${day}T00:00:00.000Z`).toISOString() : null);

/** "YYYY-MM-DD" of today + 7 days in the device's time zone. */
export function defaultDueDay(now = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export interface TaskWithPlace extends Task {
  hiveName: string | null;
  apiaryName: string | null;
}

/**
 * Every task assigned to the user (dashboard) or on one hive (hive Tasks screen), due date
 * ascending with empty dates last, with place names resolved by separate queries (SCAR S-DATA-8).
 */
export async function loadTasks(by: { userId: string } | { hiveId: string }): Promise<TaskWithPlace[]> {
  const base = supabase.from('tasks').select('*');
  const { data, error } = await ('hiveId' in by ? base.eq('hive_id', by.hiveId) : base.eq('assigned_user_id', by.userId)).order('due_date', {
    ascending: true,
    nullsFirst: false,
  });
  if (error) throw new Error(error.message);
  const tasks = data ?? [];
  const hiveIds = [...new Set(tasks.map(t => t.hive_id).filter((x): x is string => !!x))];
  const { data: hives } = hiveIds.length ? await supabase.from('hives').select('id, name, apiary_id').in('id', hiveIds) : { data: [] };
  const apiaryIds = [...new Set([...tasks.map(t => t.apiary_id), ...(hives ?? []).map(h => h.apiary_id)].filter((x): x is string => !!x))];
  const { data: apiaries } = apiaryIds.length ? await supabase.from('apiaries').select('id, name').in('id', apiaryIds) : { data: [] };
  const hiveById = new Map((hives ?? []).map(h => [h.id, h]));
  const apiaryName = new Map((apiaries ?? []).map(a => [a.id, a.name]));
  return tasks.map(t => {
    const hive = t.hive_id ? hiveById.get(t.hive_id) : undefined;
    const aid = t.apiary_id ?? hive?.apiary_id ?? null;
    return { ...t, hiveName: hive?.name ?? null, apiaryName: aid ? (apiaryName.get(aid) ?? null) : null };
  });
}

export function placeLine(t: Pick<TaskWithPlace, 'hiveName' | 'apiaryName'>): string {
  if (t.apiaryName && t.hiveName) return `${t.apiaryName} / ${t.hiveName}`;
  return t.hiveName ?? t.apiaryName ?? 'General Task';
}

const withTimeout = <T,>(p: PromiseLike<T>, ms: number) =>
  Promise.race([p, new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`Database update request timed out after ${ms / 1000} seconds.`)), ms))]);

export interface TaskFields {
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  description: string | null;
}

export async function saveTask(existing: Pick<Task, 'id' | 'hive_id' | 'apiary_id' | 'scope'> | null, fields: TaskFields, place: { hiveId: string | null; apiaryId: string | null }, userId: string) {
  if (existing) {
    const row = { ...fields, scope: taskScope(existing.hive_id, existing.apiary_id, existing.scope), assigned_user_id: userId };
    const { error } = await withTimeout(supabase.from('tasks').update(row).eq('id', existing.id), 8000);
    if (error) throw new Error(error.message);
  } else {
    const row = { ...fields, hive_id: place.hiveId, apiary_id: place.apiaryId, scope: taskScope(place.hiveId, place.apiaryId), assigned_user_id: userId };
    const { error } = await supabase.from('tasks').insert(row);
    if (error) throw new Error(error.message);
  }
}

export async function setTaskDone(id: string, done: boolean) {
  const { error } = await supabase
    .from('tasks')
    .update({ status: done ? 'completed' : 'pending', completed_at: done ? new Date().toISOString() : null })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteTask(id: string) {
  const { error } = await supabase.from('tasks').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
