import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' keeps the build portable (static hosting, app wrappers for mobile).
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { host: true },
})
