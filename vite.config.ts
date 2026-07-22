import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        // Split the vendors that never change from the app code that does.
        // Same total bytes on a cold first load, but the service worker caches
        // each chunk under its own hashed URL — so shipping an app change no
        // longer makes everyone re-download ~300KB of Firebase.
        manualChunks: {
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          react: ['react', 'react-dom'],
          motion: ['motion/react'],
        },
      },
    },
  },
})
