import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { createHtmlPlugin } from 'vite-plugin-html';

export default defineConfig({
  plugins: [
    react(),
    createHtmlPlugin({
      inject: {
        data: {
          NODE_ENV: process.env.NODE_ENV || 'development',
        },
      },
    }),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'service-worker.ts',
      registerType: 'auto',
      injectManifest: {
        swDest: 'dist/service-worker.js',
      },
      manifest: {
        name: 'MilleGrilles',
        short_name: 'MilleGrilles',
        description: 'MilleGrilles Authentication',
        start_url: '/millegrilles/',
        display: 'standalone',
        background_color: '#021024',
        theme_color: '#021024',
        icons: [
          {
            src: '/favicon.ico',
            sizes: '64x64',
            type: 'image/x-icon',
          },
          {
            src: '/millegrilles_512.jpg',
            sizes: '512x512',
            type: 'image/jpeg',
          },
          {
            src: '/millegrilles_192.jpg',
            sizes: '192x192',
            type: 'image/jpeg',
          },
        ],
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    server: {
      deps: {
        inline: ['@dugrema/node-forge'],
      },
    },
  },
});
