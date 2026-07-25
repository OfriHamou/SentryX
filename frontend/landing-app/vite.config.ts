import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5004, // 5001 customer, 5002 admin, 5003 organization
    allowedHosts: ['sentryx.cs.colman.ac.il'],
  },
})
