import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

const vendorChunk = (id: string) => {
  if (id.includes('node_modules')) {
    if (/node_modules\/(react|react-dom|react-router-dom)/.test(id)) {
      return 'vendor-react';
    }
    if (/node_modules\/firebase/.test(id)) {
      return 'vendor-firebase';
    }
    if (/node_modules\/(@googlemaps|framer-motion|zustand)/.test(id)) {
      return 'vendor-utils';
    }
  }
};

export default defineConfig({
  plugins: [react()],
  publicDir: 'public',
  root: '.', // Tell Vite to treat project root as the frontend root
  build: {
    sourcemap: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
      mangle: true,
    },
    outDir: 'dist', // Output folder
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'index.html'), // Explicitly set input
      output: {
        manualChunks: vendorChunk
      }
    }
  }
});
