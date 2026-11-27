import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Capacitor Android loads the built app from its local WebView origin.
// Relative asset paths are required so the JS/CSS bundles load on-device.
export default defineConfig({
  base: './',
  plugins: [react()],
})
