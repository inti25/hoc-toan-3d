import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/hoc-toan-3d/',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.ico',
        'apple-touch-icon.png',
        'icons/favicon-16x16.png',
        'icons/favicon-32x32.png',
        'icons/logo-ui.png'
      ],
      manifest: {
        name: 'Vương Quốc Học Toán 3D – Học Toán Vui Cho Bé',
        short_name: 'Học Toán 3D',
        description: 'Game 3D giúp bé học toán và bảng cửu chương thông qua phiêu lưu, nhiệm vụ xây cầu và thử thách toán học Archimedes.',
        theme_color: '#194f42',
        background_color: '#c9e9e5',
        display: 'standalone',
        orientation: 'any',
        start_url: '/hoc-toan-3d/',
        scope: '/hoc-toan-3d/',
        icons: [
          {
            src: 'icons/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icons/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'icons/pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2}'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/3dmodel/'),
            handler: 'CacheFirst',
            options: {
              cacheName: '3d-models-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 365
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30
              }
            }
          }
        ]
      }
    })
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three') || id.includes('three/addons')) {
            return 'vendor-three';
          }
        }
      }
    }
  }
});
