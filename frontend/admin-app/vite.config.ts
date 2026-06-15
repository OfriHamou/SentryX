import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/admin/', // Tells Vite to look for assets under /admin/ instead of the root
  server: {
    port: 5002,
    allowedHosts: ['sentryx.cs.colman.ac.il'] // Fixes the "Blocked request" error
  }
})