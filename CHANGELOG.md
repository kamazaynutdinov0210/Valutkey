# Changelog

All notable changes to VaultKey are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- CRM-style entrance: shared `AuthLayout`, redesigned unlock/setup/restore flows.
- Password Health center (`analyzeVaultHealth`) with score, reused/weak/old/insecure-URL reporting, and actionable suggestions.
- Optional, consent-gated breach checking (k-anonymity range query; no plaintext/full hash leaves the browser).
- CSV import with preview, dedup, and unsafe-URL scheme removal.
- Local, metadata-only security activity timeline (encrypted sealed record when vault key is available).
- Vault organization: sort (title/updated/recent/added), favorites-only, category filter, category field, and `markAccessed` (recently used).
- Reliability UX for backup/sync: permission/conflict/rollback/offline guidance, busy states, older-copy confirmation.
- `docs/COMPATIBILITY.md`, `docs/IMPORT_EXPORT.md`, `docs/PRIVACY.md`, `docs/SECURITY_AUDIT.md`, `docs/COMPLETE_PROJECT_AUDIT.md`.
- Repository scaffolding: `LICENSE` (MIT), `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, issue/PR templates, Dependabot, CodeQL, `.editorconfig`, `.gitattributes`.

### Changed
- UI/UX 2.0 polish across all screens; stronger focus-visible and reduced-motion handling; 44px touch targets; WCAG-oriented contrast fixes.
- Backup/sync status messaging and merge outcome reporting.

### Fixed
- Device-unlock enrollment race/state guard (re-check expected vault id).
- Restore atomicity (prefer atomic `replaceVault`/`idbVaultReplacer`) and device-binding scrub on whole-vault replacement.
- E2E regressions from restyle (search/history/reminders copy, a11y `Back` selector ambiguity, dark-mode contrast).

### Security
- CSP `connect-src` limited to `'self' https://api.pwnedpasswords.com` for opt-in k-anonymity breach checks only.
- Metadata-only activity; unsafe URL schemes stripped on import.
- **KDF anti-downgrade (S1):** sync auto-adoption refuses a header whose KDF cost is weaker than the current header (`weak-header`); equal/stronger still adopted.
- **Argon2 bounding (S2):** worker client enforces a 60s timeout (`kdf-timeout`) and the worker re-validates memory/iteration limits as defense in depth.

### Changed (toolchain)
- Upgraded dev toolchain to Vite 7.3 / Vitest 4.1 / `@vitejs/plugin-react` 5.2 / vite-plugin-pwa 1.3 / ESLint 9.39 / `typescript-eslint` 8.72 / TypeScript 5.9 / Playwright 1.65. Cleared all high/critical dev advisories (remaining 12 are low/moderate dev/build transitives). Node 20.19+/22.12+ required.
- Accessibility scans now target WCAG 2.2 A/AA (light + dark, desktop + phone).
- CI/CD: all workflow actions pinned to 40-hex commit SHAs; `npm run lint:actions` enforces this.

## [1.0.0-rc.1] — prior baseline
- See `docs/MILESTONES.md` (M0–M8) and git history for the baseline feature set.