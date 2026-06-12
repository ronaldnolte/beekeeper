import { supabase } from './supabase';

export async function fetchHives(apiaryId: string) {
  const { data, error } = await supabase
    .from('hives')
    .select('*')
    .eq('apiary_id', apiaryId)
    .order('name', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function fetchHiveDetail(hiveId: string) {
  const { data, error } = await supabase
    .from('hives')
    .select('*')
    .eq('id', hiveId)
    .single();
  if (error) throw error;
  return data;
}

export async function createHive(data: {
  name: string;
  apiary_id: string;
  type: string;
  bars?: any;
}) {
  const { error } = await supabase.from('hives').insert([data]);
  if (error) throw error;
}

export async function updateHive(
  id: string,
  data: { name: string; apiary_id: string; type: string; notes?: string }
) {
  const { error } = await supabase.from('hives').update(data).eq('id', id);
  if (error) throw error;
}

export async function deleteHive(id: string) {
  // Delete child records first to avoid FK constraint violations
  const results = await Promise.all([
    supabase.from('tasks').delete().eq('hive_id', id),
    supabase.from('interventions').delete().eq('hive_id', id),
    supabase.from('hive_snapshots').delete().eq('hive_id', id),
    supabase.from('inspections').delete().eq('hive_id', id),
    supabase.from('varroa_tests').delete().eq('hive_id', id),
  ]);

  const childError = results.find((r) => r.error)?.error;
  if (childError) throw childError;

  // Now delete the hive itself
  const { error } = await supabase.from('hives').delete().eq('id', id);
  if (error) throw error;
}

export async function updateHiveStatus(hiveId: string, status: string) {
  const { error } = await supabase
    .from('hives')
    .update({ status })
    .eq('id', hiveId);
  if (error) throw error;
}

export async function saveHiveBars(hiveId: string, bars: any) {
  const { error } = await supabase
    .from('hives')
    .update({ bars })
    .eq('id', hiveId);
  if (error) throw error;
}

export async function saveHiveSnapshot(hiveId: string, snapshotData: any) {
  const { error } = await supabase.from('hive_snapshots').insert([
    {
      hive_id: hiveId,
      timestamp: new Date().toISOString(),
      ...snapshotData,
    },
  ]);
  if (error) throw error;
}

export async function fetchApiariesForDropdown(userId: string) {
  const { data, error } = await supabase
    .from('apiaries')
    .select('id, name')
    .eq('user_id', userId);
  if (error) throw error;
  return data || [];
}
