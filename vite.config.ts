import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// Tauri expects a fixed dev port and handles its own console output.
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    // data/ holds the dev database; its writes must not trigger reloads.
    watch: { ignored: ['**/src-tauri/**', '**/data/**'] },
  },
  build: {
    target: 'es2022',
  },
})
