import { defineConfig } from 'vite';
import { resolve } from 'path';

// SCRK Ethanol Calculator — Vite Multi-Page Config
// https://vitejs.dev/guide/build#multi-page-app
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main:         resolve(__dirname, 'index.html'),
        blendPlanner: resolve(__dirname, 'blend-planner.html'),
        docs:         resolve(__dirname, 'docs.html'),
      },
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
    cssCodeSplit: false,
    assetsInlineLimit: 4096,
    outDir: 'dist',
    emptyOutDir: true,
  },

  server: {
    port: 3000,
    open: '/index.html',
    proxy: {
      '/api': {
        target: 'https://ethanolfuelmixcalculator.charans1089.workers.dev',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },

  preview: {
    port: 4000,
    open: true,
  },
});
