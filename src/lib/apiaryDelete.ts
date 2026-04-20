import { supabase } from './supabase';

export const deleteApiaryWithCascade = async (apiaryId: string, userId: string): Promise<void> => {
  // 1. Get all hive IDs inside this apiary to cascade delete their dependencies
  const { data: hives } = await supabase
    .from('hives')
    .select('id')
    .eq('apiary_id', apiaryId);
    
  const hiveIds = hives?.map(h => h.id) || [];

  // 2. If there are hives, delete their child records first (run in parallel for speed)
  if (hiveIds.length > 0) {
    const results = await Promise.all([
      supabase.from('tasks').delete().in('hive_id', hiveIds),
      supabase.from('interventions').delete().in('hive_id', hiveIds),
      supabase.from('hive_snapshots').delete().in('hive_id', hiveIds),
      supabase.from('inspections').delete().in('hive_id', hiveIds)
    ]);
    
    const childError = results.find(r => r.error)?.error;
    if (childError) throw childError;
  }

  // 3. Delete the hives themselves, plus any weather forecasts linked to the apiary
  const hiveResults = await Promise.all([
    supabase.from('hives').delete().eq('apiary_id', apiaryId),
    supabase.from('weather_forecasts').delete().eq('apiary_id', apiaryId)
  ]);
  
  const hiveError = hiveResults.find(r => r.error)?.error;
  if (hiveError) throw hiveError;

  // 3.5 VERIFY the hives were actually deleted (RLS can silently block deletes)
  const { count } = await supabase
    .from('hives')
    .select('*', { count: 'exact', head: true })
    .eq('apiary_id', apiaryId);
    
  if (count && count > 0) {
    throw new Error(`Failed to delete all hives. ${count} hive(s) could not be deleted. You may need to delete them manually first.`);
  }

  // 4. Finally, delete the apiary itself now that constraints are cleared
  const { error: deleteError } = await supabase
    .from('apiaries')
    .delete()
    .eq('id', apiaryId)
    .eq('user_id', userId);

  if (deleteError) throw deleteError;
};
