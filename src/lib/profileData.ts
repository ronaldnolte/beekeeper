// Profile and roadmap data — SPEC C §5–§7, SPEC E (profiles, app_feedback, feature_requests,
// feature_votes). None of the profile preferences change app behaviour yet (DESIGN-REQUIREMENTS).

import { supabase } from './supabase';
import { apiBase } from './platform';
import type { Tables } from './database.types';

// ---------- profile ----------

export interface ProfileFields {
  display_name: string | null;
  experience_years: number | null;
  default_hive_type: 'Top Bar' | 'Langstroth' | null;
  default_bar_count: number | null;
  treatment_approach: 'treatment_free' | 'organic' | 'conventional' | 'undecided' | null;
  analytics_opt_out: boolean;
}

export const EMPTY_PROFILE: ProfileFields = {
  display_name: null,
  experience_years: null,
  default_hive_type: null,
  default_bar_count: null,
  treatment_approach: null,
  analytics_opt_out: false,
};

/** No row, or a read failure, falls back to the defaults. */
export async function loadProfile(userId: string): Promise<ProfileFields> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error || !data) return EMPTY_PROFILE;
  return {
    display_name: data.display_name,
    experience_years: data.experience_years,
    default_hive_type: (data.default_hive_type as ProfileFields['default_hive_type']) ?? null,
    default_bar_count: data.default_bar_count,
    treatment_approach: (data.treatment_approach as ProfileFields['treatment_approach']) ?? null,
    analytics_opt_out: data.analytics_opt_out,
  };
}

export async function saveProfile(userId: string, p: ProfileFields) {
  const { error } = await supabase.from('profiles').upsert({ id: userId, ...p }, { onConflict: 'id' });
  if (error) throw new Error(error.message);
}

/** Whole number clamped to [min, max]; blank → null. */
export function clampInt(raw: string, min: number, max: number): number | null {
  if (raw.trim() === '') return null;
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, n));
}

// ---------- feedback ----------

/**
 * Row first, then the email alert. Deliberate change #16 (Ron, 2026-09-29): once the row is
 * saved the message has arrived, so an email failure is only logged — the live app told the
 * user "Failed to send" for a message it had kept.
 */
export async function sendFeedback(message: string, email: string) {
  const { error } = await supabase.from('app_feedback').insert({ message, email: email.trim() || null, created_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
  try {
    const { data } = await supabase.auth.getSession();
    const res = await fetch(`${apiBase()}/api/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, email: email.trim() || null, sessionToken: data.session?.access_token }),
    });
    if (!res.ok) console.warn('[feedback] email alert failed', res.status);
  } catch (err) {
    console.warn('[feedback] email alert failed', err);
  }
}

// ---------- roadmap ----------

export type FeatureRequest = Tables<'feature_requests'>;
export interface RoadmapItem extends FeatureRequest {
  votes: number;
  mine: boolean;
}

/** All requests and all votes, counted here; votes descending, then newest first. */
export async function loadRoadmap(userId: string): Promise<RoadmapItem[]> {
  const [{ data: reqs, error }, { data: votes }] = await Promise.all([
    supabase.from('feature_requests').select('*'),
    supabase.from('feature_votes').select('feature_id, user_id'),
  ]);
  if (error) throw new Error(error.message);
  const items = (reqs ?? []).map(r => {
    const v = (votes ?? []).filter(x => x.feature_id === r.id);
    return { ...r, votes: v.length, mine: v.some(x => x.user_id === userId) };
  });
  return sortRoadmap(items);
}

export const sortRoadmap = <T extends { votes: number; created_at: string }>(items: T[]) =>
  [...items].sort((a, b) => b.votes - a.votes || Date.parse(b.created_at) - Date.parse(a.created_at));

export async function setVote(featureId: string, userId: string, on: boolean) {
  const { error } = on
    ? await supabase.from('feature_votes').insert({ feature_id: featureId, user_id: userId })
    : await supabase.from('feature_votes').delete().eq('feature_id', featureId).eq('user_id', userId);
  if (error) throw new Error(error.message);
}

export async function submitIdea(userId: string, title: string, description: string) {
  const { error } = await supabase.from('feature_requests').insert({ title, description, status: 'pending', user_id: userId });
  if (error) throw new Error(error.message);
}

/**
 * Admin writes. The database is the real gate: a non-admin update/delete matches no rows and
 * returns no error, so ask for the changed row back and treat "nothing changed" as refused.
 */
export async function adminUpdate(id: string, patch: Partial<Pick<FeatureRequest, 'status' | 'title' | 'description'>>) {
  const { data, error } = await supabase.from('feature_requests').update(patch).eq('id', id).select('id');
  if (error || !data?.length) throw new Error(error?.message ?? 'not permitted');
}

export async function adminDelete(id: string) {
  const { data, error } = await supabase.from('feature_requests').delete().eq('id', id).select('id');
  if (error || !data?.length) throw new Error(error?.message ?? 'not permitted');
}
