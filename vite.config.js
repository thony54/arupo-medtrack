import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['arupo-logo.png', 'favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
      manifest: {
        name: 'Arupo MedTrack',
        short_name: 'MedTrack',
        description: 'Gestión de Inventario y Donaciones - Fundación Arupo',
        theme_color: '#10b981',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            // Solo se cachea lo que el modo offline necesita de verdad:
            // catálogo, lotes y categorías. Antes se cacheaba TODO
            // /rest/v1, incluidos `beneficiarios` (nombre, cédula,
            // dirección) y `evaluaciones_salud` (datos clínicos), que
            // quedaban 30 días en el disco del navegador.
            urlPattern: ({ url }) =>
              url.href.includes('supabase.co/rest/v1') &&
              /\/rest\/v1\/(medicinas|lotes|categorias)(\?|$)/.test(url.href),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'supabase-api-cache',
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 60 * 60 * 24 * 7 // 7 días (antes 30)
              },
              cacheableResponse: {
                // Sin el 0: las respuestas opacas no deben almacenarse.
                statuses: [200]
              }
            }
          }
        ]
      }
    })
  ],
})

