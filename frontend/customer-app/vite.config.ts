import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5001, // Matches your Nginx customer proxy port
    allowedHosts: ['sentryx.cs.colman.ac.il'] // Fixes the "Blocked request" error
  }
})