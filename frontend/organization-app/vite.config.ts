import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  assetsInclude: ['**/*.PNG'],
  base: '/org/', // Served under /org/ by Nginx; landing page owns the root
  server: {
    port: 5003, // Different from admin and customer apps
    allowedHosts: ['sentryx.cs.colman.ac.il'], 
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
})
