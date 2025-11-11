import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  publicDir: 'public',
  root: '.', // Tell Vite to treat project root as the frontend root
  build: {
    outDir: 'dist', // Output folder
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'index.html') // Explicitly set input
    }
  }
});
