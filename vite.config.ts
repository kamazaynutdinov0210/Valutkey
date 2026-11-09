import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { SECURITY_HEADERS, toHeadersFile } from './security-headers'

// Emits dist/_headers so the host applies the same CSP we test against.
const headersFile = (): Plugin => ({
  name: 'vaultkey-headers-file',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: '_headers', source: toHeadersFile() })
  },
})

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      // 'prompt': a new version never swaps in while a vault may be unlocked.
      registerType: 'prompt',
      injectRegister: false, // we register from main.tsx; no inline script needed
      manifest: {
        id: '/',
        name: 'VaultKey',
        short_name: 'VaultKey',
        description: 'A private password manager and generator that works offline.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#0f172a',
        theme_color: '#1e3a8a',
        categories: ['security', 'utilities'],
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,wasm,webmanifest}'],
        // the typed-password dictionaries are one big chunk; cache it so the meter works offline
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
    headersFile(),
  ],
  preview: { headers: SECURITY_HEADERS },
  worker: { format: 'es' }, // the Argon2 worker is a module worker
  build: {
    target: 'es2022',
    sourcemap: false,
    // The one large chunk is the typed-password dictionary. It loads only when a password is first checked, and is cached for offline use.
    chunkSizeWarningLimit: 1300,
    // Only `vite build --mode e2e` includes the crypto check page used by Playwright.
    // The normal production build never ships it.
    rollupOptions:
      mode === 'e2e'
        ? { input: { main: 'index.html', cryptoCheck: 'e2e-fixtures/crypto-check.html' } }
        : {},
  },
}))
