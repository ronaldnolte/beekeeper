import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { checkDatabase } from './config/database-guard.ts';

function databaseGuard(env: Record<string, string>): Plugin {
  return {
    name: 'beekeeper-database-guard',
    configResolved() {
      const problem = checkDatabase({
        supabaseUrl: env.VITE_SUPABASE_URL,
        onVercel: process.env.VERCEL === '1',
        branch: process.env.VERCEL_GIT_COMMIT_REF,
      });
      if (problem) throw new Error(`[database guard] ${problem}`);
    },
  };
}

// UTC build time "YYYY-MM-DD HH:MM" (SPEC D §9), shown on the Nectar readout strip.
const buildTime = new Date().toISOString().slice(0, 16).replace('T', ' ');

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env } as Record<string, string>;
  return {
    plugins: [databaseGuard(env), react(), tailwindcss()],
    define: { __BUILD_TIME__: JSON.stringify(buildTime) },
    // Older browsers (SCAR S-UI-11: Chromebooks broke on modern syntax).
    build: { target: 'es2015', cssTarget: 'chrome61' },
  };
});
