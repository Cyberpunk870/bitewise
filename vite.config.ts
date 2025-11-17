import { defineConfig, splitVendorChunkPlugin } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    react(),
    splitVendorChunkPlugin()
  ],
  publicDir: 'public',
  root: '.', // Tell Vite to treat project root as the frontend root
  build: {
    outDir: 'dist', // Output folder
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'index.html'), // Explicitly set input
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-firebase': ['firebase', 'firebase-admin'],
          'vendor-utils': ['zustand', 'framer-motion', '@googlemaps/js-api-loader']
        }
      }
    }
  }
});
