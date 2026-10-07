import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// base: './' gör att bygget fungerar oavsett var det hostas (t.ex. GitHub Pages).
export default defineConfig({
  base: './',
  plugins: [react()],
})
