import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import sitemap from 'vite-plugin-sitemap';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),

    // ── Sitemap automatique ──────────────────────────────────────────
    // Généré à chaque build dans /dist/sitemap.xml
    // À soumettre dans Google Search Console après le premier déploiement
    sitemap({
      hostname: 'https://le-compagnon-dnd.fr',
      dynamicRoutes: [
        '/',
        '/changelog',
      ],
      // Priorités SEO : homepage en premier
      changefreq: 'weekly',
      priority: 0.8,
    }),

    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true,
        type: 'module'
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 5 * 60
              },
              networkTimeoutSeconds: 10
            }
          }
        ],
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true
      },
      manifest: {
        // ── Corrigé : nom cohérent avec la homepage ──────────────────
        name: 'Le Compagnon D&D',
        short_name: 'Le Compagnon',
        // ── Corrigé : description à jour (était "2024") ──────────────
        description: 'Application D&D 5e en français — fiches de personnage, combats, sorts et campagnes.',
        theme_color: '#1f2937',
        background_color: '#111827',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/apple-touch-icon.png',
            sizes: '180x180',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      react: path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom')
    }
  },
  optimizeDeps: {
    include: ['react', 'react-dom']
  }
});