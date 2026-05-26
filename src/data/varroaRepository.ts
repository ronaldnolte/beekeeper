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

export async function createVarroaTest(data: VarroaTestPayload) {
  const mite_pct = data.bee_count > 0 ? (data.mite_count / data.bee_count) * 100 : 0;
  const { error } = await supabase.from('varroa_tests').insert([{ ...data, mite_pct }]);
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
  const mite_pct = data.bee_count > 0 ? (data.mite_count / data.bee_count) * 100 : 0;
  const { error } = await supabase
    .from('varroa_tests')
    .update({ ...data, mite_pct })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteVarroaTest(id: string) {
  const { error } = await supabase.from('varroa_tests').delete().eq('id', id);
  if (error) throw error;
}
