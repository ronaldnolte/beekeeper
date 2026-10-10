import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'node:fs'

// Build timestamp, injected at build time for the version marker.
const BUILD_TIME = new Date().toISOString().slice(0, 16).replace('T', ' ');
// App version (same as the Android versionName), shown under Settings → About.
const APP_VERSION = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version;

// Test copies (any database other than production — same rule as
// src/shared/testSite.ts) link a manifest that installs as "TEST Beekeeper",
// so an installed test site can't be mistaken for the real app.
const PRODUCTION_REF = 'ayeqrbcvihztxbrxmrth';
const testManifest = (isTestSite: boolean): Plugin => ({
  name: 'test-site-manifest',
  transformIndexHtml(html) {
    return isTestSite ? html.replace('href="/manifest.webmanifest"', 'href="/manifest-test.webmanifest"') : html;
  },
});

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const isTestSite = !String(env.VITE_SUPABASE_URL ?? '').includes(PRODUCTION_REF);
  return {
  define: {
    __BUILD_TIME__: JSON.stringify(BUILD_TIME),
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  plugins: [
    react(),
    tailwindcss(),
    testManifest(isTestSite),
  ],
  server: {
    // Dev-only proxy. The nectar route goes to the local shim
    // (local-api-server.js on :3001) — it requires a signed-in user, and only
    // the shim validates tokens against the same dev database the browser
    // session came from; the deployed prod function would reject dev tokens.
    proxy: {
      '/api/nectar-index-v2': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
      '/api': {
        target: 'https://beekeeper.beektools.com',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  build: {
    target: 'es2015'
  }
  };
})
