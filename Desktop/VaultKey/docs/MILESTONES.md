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

Not built, by decision: a server, accounts, an Electron/Tauri wrapper (the PWA installs on desktop; revisit only if a native feature is needed).
