# VaultKey

A private password manager and generator that runs in your browser as an installable app (PWA) on phone and desktop.
Everything is encrypted on your device before it is saved. There is no account and no server: the host only delivers the app's files.

**Status: 1.0 release candidate.** All automated tests pass (unit, browser, accessibility). It has **not** had an independent security audit.
Read [docs/REVIEW_NOTES.md](docs/REVIEW_NOTES.md) before relying on it for anything important.

## Features
- Password generator (8-128 characters, upper/lower/digits/symbols, no look-alikes, passphrases) with an exact strength meter. Uses `crypto.getRandomValues`.
- Strength check for passwords you already use (pattern-aware), and a hash tool (SHA-256/512, bcrypt, Argon2id) that is clearly a utility, not how your vault is stored.
- Vault: title, username, website, password, notes, tags, search, show/hide, copy with a 30-second clipboard clear, encrypted password history.
- Rotation reminders: per-entry interval, Due soon / Overdue lists, suggested new password from the entry's own settings that you confirm before it replaces the old one.
- Master password (Argon2id), AES-256-GCM encryption, recovery key, change password, new recovery key, new vault key, optional unlock with fingerprint / face / device PIN.
- Encrypted backup files, restore on a new device, and sync through a file in your own cloud folder (Chrome and Edge on a computer).
- Works offline. Installs on phone and desktop. Locks after inactivity and when closed. Light and dark mode. Built for WCAG 2.1 AA.

## Quick start (Windows PowerShell, macOS, Linux)
Requires Node.js 20 or newer. Run the commands one at a time. (Older Windows PowerShell does not understand `&&`.)

```powershell
npm install
npm run dev
```

Open the address it prints. The development server does not enforce the security policy and does not install the offline app. To try the real thing:

```powershell
npm run build
npm run preview
```

then open http://localhost:4173.

## Scripts
| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Type-check and build to `dist/` |
| `npm run preview` | Serve `dist/` with the real security headers |
| `npm run lint` | ESLint (also forbids `console`, so secrets cannot be logged by accident) |
| `npm run typecheck` | TypeScript for the app, service worker, and config |
| `npm test` | Unit tests (Vitest) |
| `npx playwright install chromium` | One-time browser download for the browser tests |
| `npm run test:e2e` | Builds, serves, and runs the browser tests at desktop and 360 px phone size, including accessibility scans |
| `npm run audit:prod` | Dependency audit of what ships to users |

## Deploy
VaultKey is static files. Build, then upload `dist/`.

```powershell
npm run build
```

1. **Use a host that applies custom HTTP headers.** The build writes `dist/_headers`, which Netlify and Cloudflare Pages read automatically. It contains the strict Content Security Policy and other headers. Some of them (for example `frame-ancestors`) only work as real HTTP headers, so **GitHub Pages is not suitable**: it cannot set them.
2. **Serve over HTTPS only.** The service worker, encryption and passkeys need a secure context (localhost is exempt for testing).
3. **Self-hosting (nginx, Apache, ...):** copy each header from `dist/_headers` into your server config, and serve `index.html` for unknown paths. Example for nginx:
   ```nginx
   location / {
     try_files $uri /index.html;
     add_header Content-Security-Policy "<copy the value from dist/_headers>" always;
     add_header Referrer-Policy "no-referrer" always;
     add_header X-Content-Type-Options "nosniff" always;
     add_header Strict-Transport-Security "max-age=31536000" always;
     add_header Cross-Origin-Opener-Policy "same-origin" always;
   }
   location = /sw.js { add_header Cache-Control "no-cache"; }
   ```
4. **Pick a final address before anyone uses it.** Saved data and passkeys belong to the exact web address. Moving to a different domain starts from nothing; people would restore from a backup file.
5. **Updating:** deploy the new build. People see "A new version of VaultKey is ready" and restart when they choose (this locks the vault). Never serve an old `sw.js` from a long-lived cache.
6. After deploying, check the security headers (for example with securityheaders.com) and run Lighthouse's PWA audit on the live address.

## Project layout
```
src/crypto/      key derivation, encryption, wrapping, recovery key, rotation (the only code that touches keys)
src/generator/   random numbers, password and passphrase generation, strength
src/vault/       entries, search, session (holds the unlocked key), storage
src/reminders/   due-date arithmetic, suggestions, notifications
src/sync/        backup file format, merge, sync, restore
src/unlock/      unlock with this device (WebAuthn PRF)
src/pwa/         install, updates, persistent storage, closed-app reminders
src/ui/          screens and components
src/sw.ts        service worker
tests/unit/      Vitest      tests/e2e/   Playwright (+ axe accessibility)
docs/            architecture, threat model, review notes, user guide, milestones
```

## Documentation
- [User guide](docs/USER_GUIDE.md): installing on phone and desktop, everyday use, backups, recovery.
- [Architecture](docs/ARCHITECTURE.md): layers, key hierarchy, data model, encryption flow.
- [Threat model](docs/THREAT_MODEL.md): what it protects against and what it does not.
- [Review notes](docs/REVIEW_NOTES.md): where to look first, assumptions, known limits.
- [Milestones](docs/MILESTONES.md): how it was built.

## Security in one paragraph
Your master password is stretched with Argon2id (64 MiB, 3 passes) and split into two independent values: one verifies the password, the other unlocks a random
256-bit vault key. That key encrypts every entry with AES-256-GCM, with each entry's id and the vault id bound in so entries cannot be moved or swapped. The vault key is also
stored locked under a random 256-bit recovery key. The unlocked key is a non-extractable browser key held only in memory. Nothing is sent anywhere: the policy
`connect-src 'self'` stops the app contacting any other site.
