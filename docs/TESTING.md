# Testing

## Commands

- `npm run typecheck` — TypeScript (app, service worker, config).
- `npm run lint` — ESLint (no `console`, unused vars).
- `npm test` — Vitest unit tests.
- `npm run build` / `npm run build:e2e` — production build.
- `npm run test:e2e` — Playwright (desktop + 360px phone, axe a11y light/dark).
- `npm run audit:prod` — production dependency audit.
- `npm run lint:actions` — GitHub Actions pin check.

## Coverage focus

- Cryptographic primitives and KDF validation.
- Entry normalization, search, import CSV.
- Sync service and merge.
- Password health, breach check, activity.
- Device unlock.
- Applications logic (filtering, sorting, grouping, due/overdue).

## Status

- Implemented: unit, integration (storage/sync), E2E, a11y, responsive.
- Partially implemented: performance benchmarks, real-device QA.
- Requires manual verification: real Android/iOS/Safari/Edge/passkey hardware.
- Requires independent security audit.