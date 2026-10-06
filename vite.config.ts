import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'node:fs'

// Build timestamp, injected at build time for the version marker.
const BUILD_TIME = new Date().toISOString().slice(0, 16).replace('T', ' ');
// App version (same as the Android versionName), shown under Settings → About.
const APP_VERSION = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version;

// https://vite.dev/config/
export default defineConfig({
  define: {
    __BUILD_TIME__: JSON.stringify(BUILD_TIME),
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  plugins: [
    react(),
    tailwindcss(),
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
})
