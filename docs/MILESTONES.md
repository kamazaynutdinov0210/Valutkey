# Milestones

| # | Scope | Verified by |
|---|---|---|
| M0 | Vite + React + TypeScript + Tailwind, strict CSP and headers file, PWA shell, CI | build, CSP test, install test |
| M1 | Crypto core: Argon2id worker, HKDF, AES-256-GCM, key wrapping, verifier, recovery key, constant-time compare | known-answer vectors (AES-GCM, HKDF, Argon2id), tamper and wrong-key tests |
| M2 | Generator, entropy math, strength meter, hash tool | bias, entropy and class-guarantee tests |
| M3 | Four-screen app: setup, recovery key, unlock, auto-lock, vault (add, edit, delete, search, tags, copy and clear) | unit + browser tests |
| M4 | Rotation reminders, suggestions, history, opt-in notification | date maths tested in four time zones, browser test with a moved clock |
| M5 | Install prompt, offline, update banner, persistent storage, opt-in closed-app reminders | offline browser test |
| M6 | Encrypted backup, restore, folder sync, per-entry merge, tamper and rollback checks | multi-device scenarios, tamper tests |
| M7 | Change password, new recovery key, new vault key, replace-from-file, unlock with this device | rotation tests, virtual-passkey browser test |
| M8 | Accessibility scans and fixes, headers, documentation, review notes | axe scans in light and dark, tap-target and focus tests |
| M9 | Device-unlock enrollment race/state guard; restore atomicity; whole-vault binding scrub | `tests/unit/device-unlock.test.ts`, entries tests |
| M10 | Password Health foundation (`analyzeVaultHealth`) + UI | `tests/unit/health.test.ts` |
| M11 | k-anonymity breach check (opt-in, consent-gated) + CSP `connect-src` | `tests/unit/breach.test.ts`, `security-headers.test.ts` |
| M12 | CSV import: preview/mapping/dedup/unsafe-URL removal | `tests/unit/importCsv.test.ts` |
| M13 | Security Activity 2.0: metadata-only log, encrypted-at-rest when unlocked | `tests/unit/activity.test.ts` |
| M14 | Vault org: sort/favorites/category/last-used filters + UI | `tests/unit/search.test.ts`, e2e |
| M15 | UI/UX 2.0 polish + a11y foundations (focus, motion, contrast) | Playwright axe (light/dark, desktop/phone) |
| M16 | Backup/sync reliability UX (permission/conflict/rollback/offline) | e2e backup suite |
| M17 | Performance (memoized derivations) + compatibility matrix | `docs/COMPATIBILITY.md` |
| M18 | Validation: full e2e/axe, regression fixes, dependency audit status, S1/S2 hardening, toolchain upgrade | e2e 68/68, `audit:prod` 0, dev audit 0 high/critical, unit 275/275 |
| M19 | Dashboard wiring (Home tab), entry duplicate action in UI, README WCAG 2.2 note, lint/typecheck green | typecheck, lint, unit 275/275, e2e 68/68 |
| M20 | Applications & Accounts module, automation registry/adapters, automation toggle, snooze, Entry model extensions, a11y transition fix | typecheck, lint, unit 275/275, e2e 68/68 |

Not built, by decision: a server, accounts, an Electron/Tauri wrapper (the PWA installs on desktop; revisit only if a native feature is needed).
