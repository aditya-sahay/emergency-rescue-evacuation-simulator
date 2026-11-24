import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' makes the production build work from any sub-path (GitHub Pages, Netlify, Vercel)
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: { output: { manualChunks: { three: ['three'] } } },
  },
});
