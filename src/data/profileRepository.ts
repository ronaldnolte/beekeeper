import { supabase } from './supabase';

/**
 * The beekeeper's own profile — see migration 0012. Every field is optional
 * except the analytics choice, because a profile is something you fill in over
 * time, not a gate you pass through on the way in.
 *
 * `experienceYears: null` means "hasn't said", which is deliberately different
 * from 0, a beekeeper in their first season.
 */
export interface Profile {
  id: string;
  displayName: string | null;
  experienceYears: number | null;
  defaultHiveType: 'Top Bar' | 'Langstroth' | null;
  defaultBarCount: number | null;
  treatmentApproach: 'treatment_free' | 'organic' | 'conventional' | 'undecided' | null;
  analyticsOptOut: boolean;
}

/** Everything a user can change. The id comes from the session, never the form. */
export type ProfileEdits = Omit<Profile, 'id'>;

interface ProfileRow {
  id: string;
  display_name: string | null;
  experience_years: number | null;
  default_hive_type: string | null;
  default_bar_count: number | null;
  treatment_approach: string | null;
  analytics_opt_out: boolean;
}

function fromRow(row: ProfileRow): Profile {
  return {
    id: row.id,
    displayName: row.display_name,
    experienceYears: row.experience_years,
    defaultHiveType: (row.default_hive_type as Profile['defaultHiveType']) ?? null,
    defaultBarCount: row.default_bar_count,
    treatmentApproach: (row.treatment_approach as Profile['treatmentApproach']) ?? null,
    analyticsOptOut: row.analytics_opt_out ?? false,
  };
}

/** What a beekeeper who has never opened the profile screen looks like. */
export function emptyProfile(userId: string): Profile {
  return {
    id: userId,
    displayName: null,
    experienceYears: null,
    defaultHiveType: null,
    defaultBarCount: null,
    treatmentApproach: null,
    analyticsOptOut: false,
  };
}

/**
 * Read the signed-in user's profile.
 *
 * Returns defaults rather than throwing when the row does not exist yet — most
 * users will never have one until the first time they save. A genuine failure
 * (network, RLS) is logged and also falls back to defaults, because a profile
 * screen that cannot load is a worse outcome than one showing empty fields.
 */
export async function fetchProfile(userId: string): Promise<Profile> {
  if (!userId) return emptyProfile('');

  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, experience_years, default_hive_type, default_bar_count, treatment_approach, analytics_opt_out')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.warn('fetchProfile: falling back to defaults —', error.message);
    return emptyProfile(userId);
  }
  return data ? fromRow(data as ProfileRow) : emptyProfile(userId);
}

/**
 * Create or update the profile. Upsert rather than insert-then-update because
 * the row's existence is an implementation detail the screen should not have to
 * track. Throws on failure so the screen can say so.
 */
export async function saveProfile(userId: string, edits: ProfileEdits): Promise<void> {
  if (!userId) throw new Error('Cannot save a profile without a signed-in user.');

  const { error } = await supabase.from('profiles').upsert(
    {
      id: userId,
      display_name: edits.displayName,
      experience_years: edits.experienceYears,
      default_hive_type: edits.defaultHiveType,
      default_bar_count: edits.defaultBarCount,
      treatment_approach: edits.treatmentApproach,
      analytics_opt_out: edits.analyticsOptOut,
    },
    { onConflict: 'id' }
  );

  if (error) throw error;
}
