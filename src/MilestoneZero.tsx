import { databaseOf } from '../config/database-guard';

// Temporary Milestone 0 page: proves the deployment wiring (which database, when built).
// Replaced by the real app shell in Milestone 3.
const LABEL = { production: 'PRODUCTION', test: 'Beekeeper Dev v2 (test)', unknown: 'unknown' };

export function MilestoneZero() {
  const db = databaseOf(import.meta.env.VITE_SUPABASE_URL);
  return (
    <main className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="max-w-md w-full rounded-[20px] bg-card-bg border border-card-border p-6 text-center shadow-sm">
        <img src="/logo.png" alt="" className="w-20 h-20 mx-auto mb-4" />
        <h1 className="text-2xl font-black">Beekeeper rebuild</h1>
        <p className="text-text-muted mb-4">Milestone 0: skeleton</p>
        <p>
          Database: <strong className={db === 'test' ? 'text-good-deep' : 'text-bad'}>{LABEL[db]}</strong>
        </p>
        <p className="text-xs font-mono text-text-muted mt-2">Built {__BUILD_TIME__} UTC</p>
      </div>
    </main>
  );
}
