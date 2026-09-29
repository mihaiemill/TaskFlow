import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'url'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // teste automate frontend (Vitest + Testing Library, API simulat — fără backend)
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    include: ['src/**/*.test.{js,jsx}'],
    css: false,
  },
  server: {
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5179',
        changeOrigin: true,
      },
    },
  },
})