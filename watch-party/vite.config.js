import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // This tells Vite to accept connections from Pinggy, Localtunnel, etc.
    allowedHosts: true 
  }
})