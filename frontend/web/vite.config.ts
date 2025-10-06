// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,        // 0.0.0.0 + ::
    port: 5173,        // fixed port
    strictPort: true,  // fail if in use (easier to debug)
    open: false,
    watch: { usePolling: true },
  },
  build: {
    outDir: 'build',
  },
})
