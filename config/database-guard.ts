// Refuses to build or serve the app against the wrong database.
// CONSTRAINTS §2/§4: only `main` may use production; every other branch and every local run
// must use Beekeeper Dev v2; the old "Beekeeper Dev" project must never be used again.

export const DATABASES = {
  production: 'ayeqrbcvihztxbrxmrth',
  test: 'byqznixioptovxvvonww',
  retired: 'wrdnwzgztwzoigkoebeq',
} as const;

export type DatabaseName = 'production' | 'test' | 'unknown';

export function databaseOf(url: string | undefined): DatabaseName {
  if (!url) return 'unknown';
  if (url.includes(DATABASES.production)) return 'production';
  if (url.includes(DATABASES.test)) return 'test';
  return 'unknown';
}

export interface GuardInput {
  supabaseUrl: string | undefined;
  /** true when running on Vercel (env VERCEL === '1') */
  onVercel: boolean;
  /** the git branch Vercel is building (env VERCEL_GIT_COMMIT_REF) */
  branch: string | undefined;
}

/** Returns null when allowed, otherwise the reason the build must stop. */
export function checkDatabase({ supabaseUrl, onVercel, branch }: GuardInput): string | null {
  if (!supabaseUrl) return 'VITE_SUPABASE_URL is not set.';
  if (supabaseUrl.includes(DATABASES.retired)) {
    return 'VITE_SUPABASE_URL points at the retired "Beekeeper Dev" database. Never use it.';
  }
  const db = databaseOf(supabaseUrl);
  if (db === 'unknown') return `VITE_SUPABASE_URL is not a known Beekeeper database: ${supabaseUrl}`;

  if (!onVercel) {
    return db === 'production'
      ? 'Local runs must use Beekeeper Dev v2, not production.'
      : null;
  }
  if (branch === 'main') {
    return db === 'production' ? null : 'The main branch must use the production database.';
  }
  return db === 'production'
    ? `Branch "${branch ?? 'unknown'}" would be built against PRODUCTION. ` +
        'Add this branch to the Preview test-database branch filter in Vercel.'
    : null;
}
