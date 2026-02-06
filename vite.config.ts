import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // The optional 3D graph view depends on large Three.js bundles.
    // Graph code is lazy-loaded in App, so a higher warning limit avoids noisy false positives.
    chunkSizeWarningLimit: 1500,
  },
})
