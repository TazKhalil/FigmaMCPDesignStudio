import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Web Worker support: `new Worker(new URL('./workers/rf-engine.worker.ts', import.meta.url))`
  // is handled automatically by Vite's built-in worker bundling.
  worker: {
    format: 'es',
  },
  assetsInclude: ['**/*.svg', '**/*.csv', '**/*.png'],
})
