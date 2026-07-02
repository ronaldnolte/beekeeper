import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Build timestamp, injected at build time for the version marker.
const BUILD_TIME = new Date().toISOString().slice(0, 16).replace('T', ' ');

// https://vite.dev/config/
export default defineConfig({
  define: {
    __BUILD_TIME__: JSON.stringify(BUILD_TIME),
  },
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    // Dev-only proxy. Rules match by string prefix, first match wins, so order
    // matters: '/api/nectar-index-v2' MUST come before '/api/nectar-index' or the
    // V1 shim rule swallows it (the v2 path starts with the v1 path) and it
    // ECONNREFUSEs on :3001. V2 has no local shim — it hits the deployed function.
    proxy: {
      '/api/nectar-index-v2': {
        target: 'https://beekeeper.beektools.com',
        changeOrigin: true,
        secure: false,
      },
      '/api/nectar-index': {
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
