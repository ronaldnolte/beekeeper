import { supabase } from './supabase';

export interface VarroaTestPayload {
  hive_id: string;
  user_id: string;
  tested_at: string;
  bee_count: number;
  mite_count: number;
  threshold: number;
  notes?: string | null;
}

export async function fetchVarroaTests(hiveId: string) {
  const { data, error } = await supabase
    .from('varroa_tests')
    .select('*')
    .eq('hive_id', hiveId)
    .order('tested_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// mite_pct is a generated column in the database — it is computed from
// bee_count/mite_count on write. Sending a value for it is rejected with
// "cannot insert a non-DEFAULT value into column mite_pct".
export async function createVarroaTest(data: VarroaTestPayload) {
  const { error } = await supabase.from('varroa_tests').insert([data]);
  if (error) throw error;
}

export async function updateVarroaTest(
  id: string,
  data: {
    tested_at: string;
    bee_count: number;
    mite_count: number;
    threshold: number;
    notes?: string | null;
  }
) {
  const { error } = await supabase
    .from('varroa_tests')
    .update(data)
    .eq('id', id);
  if (error) throw error;
}

export async function deleteVarroaTest(id: string) {
  const { error } = await supabase.from('varroa_tests').delete().eq('id', id);
  if (error) throw error;
}
