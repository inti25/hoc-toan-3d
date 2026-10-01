# 0006. Progressive Web App (PWA) & Offline Caching Strategy

## Context
"Vương Quốc Học Toán 3D" is an interactive 3D educational game running in browsers and deployed via GitHub Pages. Students often play on tablets (iPads, Android tablets) and laptops in school or home environments where internet connections can be intermittent.
Additionally, the game incorporates rich 3D models (`public/3dmodel/*`) totaling ~18MB (with individual `.bin` files reaching ~6MB), which exceeds standard Service Worker default precache limits (2MB).
We need to provide:
1. Full PWA capabilities (installable to homescreen, standalone full-screen window, custom icons).
2. Modern, optimized branding assets generated from `public/logo.png`.
3. High-performance offline play without burdening initial page load times with massive precache downloads.
4. Seamless in-game installation and update notification flows.

## Decision
1. **PWA Tooling with `vite-plugin-pwa`**:
   - Utilize `vite-plugin-pwa` integrated into `vite.config.ts` with `registerType: 'autoUpdate'`.
   - Configure the Web App Manifest with:
     - `name`: "Vương Quốc Học Toán 3D – Học Toán Vui Cho Bé"
     - `short_name`: "Học Toán 3D"
     - `theme_color`: `#194f42`
     - `background_color`: `#c9e9e5`
     - `display`: `standalone`
     - `start_url`: `./`
   - Configure Workbox `maximumFileSizeToCacheInBytes` to 10MB to accommodate 3D geometry buffers safely.

2. **Split Caching Strategy (Precache + Runtime Cache)**:
   - **Precaching**: Core web shell, JavaScript bundles, CSS stylesheets, HTML, fonts, and UI icon assets are precached upon install, ensuring the game shell is instant and offline-ready.
   - **Runtime Caching (`CacheFirst`)**: 3D character models and textures under `public/3dmodel/**` are dynamically cached via a `CacheFirst` strategy upon first selection/encounter. Once cached, characters function completely offline indefinitely.

3. **Multi-Scale Asset Generation**:
   - Maintain `public/logo.png` as the high-resolution master asset.
   - Automatically generate responsive icon variants in `public/icons/` and `public/`:
     - Standard favicons: `favicon.ico` (32x32), `favicon-16x16.png`, `favicon-32x32.png`, `apple-touch-icon.png` (180x180).
     - PWA icons: `pwa-192x192.png`, `pwa-512x512.png`.
     - Maskable icon: `pwa-maskable-512x512.png` with standard 10-15% safe-zone margin to prevent awkward cropping on mobile launchers.
     - Web UI logo: `logo-ui.png` (~96x96, compact) for topbar and loading screen display without megabyte-scale payload overhead.

4. **In-Game Install & Update UX**:
   - Capture the `beforeinstallprompt` browser event to power an intuitive "📲 Cài đặt ứng dụng" button inside the Settings dialog, gracefully hidden once installed or if unsupported.
   - When a new deployment is detected, service worker triggers a friendly in-game toast prompting users to reload and enjoy the latest math adventures without interrupting active gameplay.

## Consequences
- The game can be installed as a standalone native-like app on Android, iOS/iPadOS, Windows, and macOS.
- Students and teachers can play offline reliably even in classroom environments with spotty Wi-Fi.
- First-load performance remains fast while keeping 3D assets cached long-term.
