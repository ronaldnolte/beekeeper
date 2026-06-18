import { supabase } from './supabase';

export async function createInspection(payload: {
  hive_id: string;
  timestamp: string;
  queen_status: string;
  brood_pattern: string;
  temperament: string;
  honey_stores: string;
  pollen_stores: string;
  observations: string;
  review_status?: 'draft' | 'approved';
}): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from('inspections')
    .insert([payload])
    .select('id')
    .single();
  if (error) throw error;
  return data as { id: string };
}

export async function updateInspection(id: string, payload: {
  hive_id: string;
  timestamp: string;
  queen_status: string;
  brood_pattern: string;
  temperament: string;
  honey_stores: string;
  pollen_stores: string;
  observations: string;
}) {
  const { error } = await supabase
    .from('inspections')
    .update(payload)
    .eq('id', id);
  if (error) throw error;
}

export async function deleteInspection(id: string) {
  const { error } = await supabase
    .from('inspections')
    .delete()
    .eq('id', id);
  if (error) throw error;
}
