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
    proxy: {
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
