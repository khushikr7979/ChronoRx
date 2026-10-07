import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/auth': 'http://127.0.0.1:8000',
      '/patients': 'http://127.0.0.1:8000',
      '/scan': 'http://127.0.0.1:8000',
      '/drugs': 'http://127.0.0.1:8000',
      '/dose': 'http://127.0.0.1:8000',
      '/interactions': 'http://127.0.0.1:8000',
      '/schedule': 'http://127.0.0.1:8000',
      '/clinical-summary': 'http://127.0.0.1:8000',
      '/prescription': 'http://127.0.0.1:8000',
      '/prescriptions': 'http://127.0.0.1:8000',
      '/medications': 'http://127.0.0.1:8000',
      '/posology': 'http://127.0.0.1:8000',
      '/audit': 'http://127.0.0.1:8000',
      '/patient-history': 'http://127.0.0.1:8000',
      '/followups': 'http://127.0.0.1:8000',
      '/appointments': 'http://127.0.0.1:8000',
      '/dashboard': 'http://127.0.0.1:8000',
      '/uploads': 'http://127.0.0.1:8000',
      '/reports': 'http://127.0.0.1:8000',
      '/health': 'http://127.0.0.1:8000',
      '/api': 'http://127.0.0.1:8000'
    }
  }
})
