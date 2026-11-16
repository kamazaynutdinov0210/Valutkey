# Compatibility & Performance (M17)

## Browser / OS support (expected)
| Capability | Chromium (Chrome/Edge, desktop/Android) | Firefox | Safari (macOS/iOS/iPadOS) |
|---|---|---|---|
| Core vault (Web Crypto AES-GCM/HKDF, IndexedDB, Argon2id WASM worker) | Yes | Yes (modern) | Yes (modern) |
| PWA install | Yes (prompt/manual) | Manual/limited | Add to Home Screen |
| Offline (service worker precache) | Yes | Yes (modern) | Yes (with PWA limits) |
| Folder/cloud sync (File System Access API) | Yes on supported desktop Chromium | No (use manual backup merge) | No (use manual backup merge) |
| WebAuthn PRF device unlock | Partial (platform/authenticator dependent) | Limited | Limited/device dependent |
| Background reminder checks (Periodic Background Sync) | Limited (installed app, browser-dependent) | No | No |
| Clipboard auto-clear | Supported with restrictions | Supported with restrictions | Supported with restrictions |

> Real-device verification for passkeys/biometrics, cloud-folder providers (Dropbox/OneDrive/iCloud/Google Drive), iOS PWA behavior, and offline/background timing is still required.

## Performance notes
- Vault entries decrypt on unlock into in-memory session state and are dropped on lock (zero-knowledge/offline design). Search/filter/sort run over decrypted in-memory entries only.
- M17: vault list derivations (`tags`, `categories`, filtered/sorted results) are memoized to reduce unnecessary recomputation during UI updates.
- Entry list currently renders all filtered items (no virtualization). Practical for typical personal vault sizes; very large vaults may benefit from list virtualization and incremental rendering in a future pass.
- Password strength (zxcvbn) and Argon2id are compute-intensive by design; KDF runs in a worker and UI shows busy states.
- Build is chunk-split by Vite/Rollup; precache payload reported at build time (~2 MB). Further code-splitting of heavy/optional paths (e.g. dictionaries/tools) is a future optimization.

## Reliability / storage
- IndexedDB persistence is best-effort unless the browser grants durable storage (Settings → “Protect my data” / install). Browsers may evict data under pressure (Safari ITP notable). Regular encrypted backups are required.
- Sync is merge-based with integrity-checked manifests; conflicts keep newest and preserve older password in history. One-device-at-a-time sync recommended; let cloud uploads finish before syncing another device.

## Build toolchain (M18)
- Node.js **20.19+ or 22.12+** is required by Vite 7 / Vitest 4 / vite-plugin-pwa 1.3 (verified on Node 26).
- Upgraded dev toolchain: Vite 7.3, Vitest 4.1, `@vitejs/plugin-react` 5.2, vite-plugin-pwa 1.3, ESLint 9.39, `typescript-eslint` 8.72, TypeScript 5.9, Playwright 1.65.
- TypeScript is kept on 5.9 because `typescript-eslint` 8.x supports `<6.1.0` (TypeScript 7 is not yet compatible).
- Playwright browsers: `npx playwright install chromium` for the active Playwright version.
