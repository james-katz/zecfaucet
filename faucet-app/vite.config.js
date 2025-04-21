import mkcert from 'vite-plugin-mkcert';
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react(), mkcert()],
  server: {
    host: '0.0.0.0',
    https: false,
    port: 3000,
    strictPort: true,
    allowedHosts: ['.ngrok-free.app'],
    proxy: {
      '/api': {
        target: 'http://localhost:2653',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})