import { supabase } from './supabase';

export async function createIntervention(payload: {
  hive_id: string;
  timestamp: string;
  type: string;
  description: string;
}) {
  const { error } = await supabase.from('interventions').insert([payload]);
  if (error) throw error;
}

export async function updateIntervention(id: string, payload: {
  hive_id: string;
  timestamp: string;
  type: string;
  description: string;
}) {
  const { error } = await supabase
    .from('interventions')
    .update(payload)
    .eq('id', id);
  if (error) throw error;
}

export async function deleteIntervention(id: string) {
  const { error } = await supabase
    .from('interventions')
    .delete()
    .eq('id', id);
  if (error) throw error;
}
