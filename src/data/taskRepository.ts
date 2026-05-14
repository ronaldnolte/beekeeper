import { supabase } from './supabase';

export async function fetchTasks(userId: string) {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('assigned_user_id', userId)
    .order('due_date', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data || [];
}

export async function createTask(payload: {
  hive_id?: string | null;
  apiary_id?: string | null;
  assigned_user_id?: string;
  title: string;
  description: string;
  priority: string;
  due_date: string | null;
  status: string;
  scope: string;
}) {
  const { error } = await supabase.from('tasks').insert([payload]);
  if (error) throw error;
}

export async function updateTask(id: string, payload: {
  hive_id?: string | null;
  apiary_id?: string | null;
  assigned_user_id?: string;
  title: string;
  description: string;
  priority: string;
  due_date: string | null;
  status: string;
  scope: string;
}) {
  // Add timeout to prevent silent hangs
  const updatePromise = supabase.from('tasks').update(payload).eq('id', id);
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(
      () => reject(new Error('Database update request timed out after 8 seconds.')),
      8000
    )
  );
  const { error } = (await Promise.race([updatePromise, timeoutPromise])) as any;
  if (error) throw error;
}

export async function deleteTask(id: string) {
  const { error } = await supabase.from('tasks').delete().eq('id', id);
  if (error) throw error;
}

export async function toggleTaskStatus(id: string, currentStatus: string) {
  const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
  const completedAt = newStatus === 'completed' ? new Date().toISOString() : null;
  const { error } = await supabase
    .from('tasks')
    .update({ status: newStatus, completed_at: completedAt })
    .eq('id', id);
  if (error) throw error;
  return { newStatus, completedAt };
}

/**
 * Fetch location names for a list of tasks.
 * Returns a map of taskId -> { apiaryName, hiveName }
 */
export async function fetchTaskLocations(tasks: any[]) {
  const locations: Record<string, { apiaryName?: string; hiveName?: string }> = {};

  const hiveIds = [...new Set(tasks.map((t) => t.hive_id).filter(Boolean))];
  const hiveToApiaryMap = new Map<string, string>();

  if (hiveIds.length > 0) {
    const { data: hives } = await supabase
      .from('hives')
      .select('id, name, apiary_id')
      .in('id', hiveIds);
    const hiveMap = new Map(hives?.map((h) => [h.id, h.name]) || []);
    hives?.forEach((h) => {
      if (h.apiary_id) hiveToApiaryMap.set(h.id, h.apiary_id);
    });

    tasks.forEach((task) => {
      if (task.hive_id) {
        if (!locations[task.id]) locations[task.id] = {};
        locations[task.id].hiveName = hiveMap.get(task.hive_id);
      }
    });
  }

  const apiaryIdsFromTasks = tasks.map((t) => t.apiary_id).filter(Boolean);
  const apiaryIdsFromHives = Array.from(hiveToApiaryMap.values());
  const apiaryIds = [...new Set([...apiaryIdsFromTasks, ...apiaryIdsFromHives])];

  if (apiaryIds.length > 0) {
    const { data: apiaries } = await supabase
      .from('apiaries')
      .select('id, name')
      .in('id', apiaryIds);
    const apiaryMap = new Map(apiaries?.map((a) => [a.id, a.name]) || []);

    tasks.forEach((task) => {
      let apiaryId = task.apiary_id;
      if (!apiaryId && task.hive_id) apiaryId = hiveToApiaryMap.get(task.hive_id);

      if (apiaryId) {
        if (!locations[task.id]) locations[task.id] = {};
        locations[task.id].apiaryName = apiaryMap.get(apiaryId);
      }
    });
  }

  return locations;
}
