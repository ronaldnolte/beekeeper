import { supabase } from './supabase';

/**
 * Fetch history feed items for a hive.
 * Merges inspections, interventions, snapshots, and tasks into a single sorted timeline.
 */
export async function fetchHistoryFeed(
  hiveId: string,
  filter: 'inspections' | 'interventions' | 'snapshots' | 'tasks' | 'varroa_tests' | 'all' = 'all'
) {
  const promises = [];
  const limitCount = filter === 'all' ? 10 : 100;

  if (filter === 'all' || filter === 'inspections') {
    promises.push(
      supabase
        .from('inspections')
        .select('*')
        .eq('hive_id', hiveId)
        // Drafts live in the "waiting for review" list, not the normal history.
        .neq('review_status', 'draft')
        .order('timestamp', { ascending: false })
        .limit(limitCount)
        .then((res) => ({ type: 'inspection', data: res.data }))
    );
  }
  if (filter === 'all' || filter === 'interventions') {
    promises.push(
      supabase
        .from('interventions')
        .select('*')
        .eq('hive_id', hiveId)
        .order('timestamp', { ascending: false })
        .limit(limitCount)
        .then((res) => ({ type: 'intervention', data: res.data }))
    );
  }
  if (filter === 'all' || filter === 'snapshots') {
    promises.push(
      supabase
        .from('hive_snapshots')
        .select('*')
        .eq('hive_id', hiveId)
        .order('timestamp', { ascending: false })
        .limit(limitCount)
        .then((res) => ({ type: 'snapshot', data: res.data }))
    );
  }
  if (filter === 'all' || filter === 'tasks') {
    promises.push(
      supabase
        .from('tasks')
        .select('*')
        .eq('hive_id', hiveId)
        .order('created_at', { ascending: false })
        .limit(limitCount)
        .then((res) => ({ type: 'task', data: res.data }))
    );
  }
  if (filter === 'all' || filter === 'varroa_tests') {
    promises.push(
      supabase
        .from('varroa_tests')
        .select('*')
        .eq('hive_id', hiveId)
        .order('tested_at', { ascending: false })
        .limit(limitCount)
        .then((res) => ({ type: 'varroa_test', data: res.data }))
    );
  }

  const results = await Promise.all(promises);

  let merged: any[] = [];
  results.forEach((res) => {
    const items = (res.data || []).map((i: any) => ({
      ...i,
      _model_type: res.type,
      timestamp: i.timestamp || i.created_at || new Date().toISOString(),
    }));
    merged = [...merged, ...items];
  });

  merged.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return filter === 'all' ? merged.slice(0, 10) : merged;
}

export async function deleteSnapshot(id: string) {
  const { error } = await supabase
    .from('hive_snapshots')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function submitFeedback(message: string, email?: string) {
  // 1. Save to Supabase (so we have a database record backup)
  const { error } = await supabase.from('app_feedback').insert([
    {
      message,
      email: email || null,
      created_at: new Date().toISOString(),
    },
  ]);
  if (error) throw error;

  // 2. Call our Vercel serverless function to trigger the Gmail notification in real time
  try {
    const apiUrl = import.meta.env.DEV ? '/api/feedback' : 'https://beekeeper.beektools.com/api/feedback';
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message, email }),
    });
    if (!response.ok) {
      const data = await response.json();
      console.error('Failed to trigger feedback email:', data);
      throw new Error(data.error || 'Failed to trigger feedback email');
    }
  } catch (err) {
    console.error('Error calling feedback API endpoint:', err);
    throw err;
  }
}

export async function fetchFeatureRequests(userId?: string) {
  const { data: featureData, error } = await supabase
    .from('feature_requests')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;

  const { data: allVotes } = await supabase.from('feature_votes').select('*');

  const combined = (featureData || []).map((f: any) => {
    const votesForThis =
      allVotes?.filter((v) => v.feature_id === f.id) || [];
    const isVoted = userId
      ? votesForThis.some((v) => v.user_id === userId)
      : false;
    return {
      ...f,
      votes: votesForThis.length,
      is_voted_by_me: isVoted,
    };
  });

  combined.sort((a: any, b: any) => {
    if (b.votes !== a.votes) return b.votes - a.votes;
    return (
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  });

  return combined;
}

export async function submitFeatureRequest(data: {
  title: string;
  description: string;
  user_id: string;
}) {
  const { error } = await supabase.from('feature_requests').insert([
    {
      ...data,
      status: 'pending',
      created_at: new Date().toISOString(),
    },
  ]);
  if (error) throw error;
}

export async function voteOnFeature(
  featureId: string,
  userId: string,
  isCurrentlyVoted: boolean
) {
  if (isCurrentlyVoted) {
    await supabase
      .from('feature_votes')
      .delete()
      .match({ feature_id: featureId, user_id: userId });
  } else {
    await supabase
      .from('feature_votes')
      .insert({ feature_id: featureId, user_id: userId });
  }
}
