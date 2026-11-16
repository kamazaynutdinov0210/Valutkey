# Security Audit Notes (VaultKey 2.0 work in progress)

> **No independent security audit has been completed.** Automated tests passing do not prove security.

## Scope reviewed
- Key derivation (Argon2id + HKDF labels), verifier, AES-256-GCM AAD/IV use, key wrapping, recovery key, vault key rotation.
- Session/key lifetime, lock/clipboard behavior, device unlock (WebAuthn PRF), backup/sync manifest integrity and merge/restore flows.
- CSP/headers, service worker caching scope, dependency audit (prod/dev split).
- UI/auth flows (CRM-style login/setup/recovery/restore), CSV import preview/sanitization, local metadata-only security activity, password health and opt-in breach checks (k-anonymity).

## Fixes & hardening applied
- **M9:** Device-unlock enrollment race/state guard (re-check expected `vaultId` across prompt/persist). Restore prefers atomic session `replaceVault`/`idbVaultReplacer`; sync state committed after replacement. Whole-vault replacement scrubs device-local bindings (device unlock/sync handle/state/reminder hints) to avoid stale binding reuse.
- **M11:** Breach checking is opt-in and consent-gated; CSP `connect-src` limited to `'self' https://api.pwnedpasswords.com` for k-anonymity prefix lookup only (5-char SHA-1 prefix; full password/hash never sent). SHA-1 used only for this protocol, not vault encryption.
- **M12:** CSV import is local-only with preview/mapping, duplicate detection, and unsafe URL scheme removal (`javascript:`/`data:`/`vbscript:` stripped); user warned that source CSV may contain unencrypted secrets.
- **M13:** Security activity is metadata-only (no secrets/passwords) and stored locally; encrypted-at-rest sealed record when vault key context is available.
- **M16:** Backup/sync UX hardened (permission/conflict/rollback/offline guidance, older-copy confirmation, damaged-item warnings); core merge/manifest integrity logic unchanged.
- **Phase 1 (repo hardening):** Added `LICENSE` (MIT), `SECURITY.md` (private disclosure + 7/30-day targets + scope), `CONTRIBUTING.md` (security-sensitive rules), `CODE_OF_CONDUCT.md` (CFC 2.1), `CHANGELOG.md`, `docs/COMPLETE_PROJECT_AUDIT.md` (full register incl. S1–S5/F1–F5/U1–U4/R1–R5/D1–D3), `docs/RELEASE_PROCESS.md` (SBOM/checksums/provenance), issue/PR templates, `dependabot.yml`, `codeql.yml`, `.editorconfig`, `.gitattributes`, hardened `ci.yml` (concurrency, artifact upload, dev/prod audit split, `npm ci`), expanded `.gitignore` (coverage/logs/env/keys/OS/IDE).
- **S1 (KDF anti-downgrade):** Sync auto-adoption now refuses a header whose KDF cost (memKiB × iterations) is weaker than the vault's current header (`assertAdoptsKdfParams`, `weak-header`); equal or stronger is accepted, and legitimate older devices with matching costs still work. Absolute bounds (`assertKdfParams`) unchanged. Restore remains an explicit user-chosen-file path.
- **S2 (Argon2 bounding):** The worker client enforces a 60s wall-clock timeout (terminates the worker, rejects `kdf-timeout`); the worker re-validates memory/iteration bounds as defense in depth. `assertKdfParams` still caps memory at 256 MiB and 10 iterations before any Argon2 work.
- **Dev toolchain (M18):** Upgraded to Vite 7.3 / Vitest 4.1 / `@vitejs/plugin-react` 5.2 / vite-plugin-pwa 1.3 / ESLint 9.39 / `typescript-eslint` 8.72 / TypeScript 5.9 / Playwright 1.65. This cleared **all high/critical** dev advisories. Remaining: **12 (2 low, 10 moderate), all dev-only** — `minimatch`/`glob`/`deepmerge` transitives of `workbox-build` (build-time) and `minimatch@3.1.5` via ESLint; not shipped. `npm audit fix --force` remains unsafe.

## Validation status (this environment)
- `npm run typecheck`, `npm run lint`, `npm test` PASS (31 files, 275 tests), `npm run build` PASS, `npm run build:e2e` PASS, `npm run audit:prod` = 0 vulnerabilities.
- Playwright (Chromium, desktop + phone-360, Playwright 1.65): **68/68 PASS** after the M9–M18 + S1/S2 + toolchain changes (includes axe WCAG A/AA light/dark).
- `npm audit` (dev included): **12 (2 low, 10 moderate), 0 high, 0 critical**, all in dev/build tooling (see above); not shipped.
- **Not executed:** real browser/device matrix, passkey/WebAuthn PRF on real authenticators, cloud-folder providers (Dropbox/OneDrive/iCloud/Google Drive), iOS/Android install/offline/background timing, manual keyboard/screen-reader testing. Automated tests and passing checks do not prove security or accessibility.

## Known limitations (honest)
- JavaScript cannot guarantee complete memory wiping; decrypted strings may persist until GC. Non-extractable CryptoKeys and byte wiping are used where possible.
- Backup/sync headers enable offline password guessing at Argon2 cost; master password strength is critical.
- Browser storage is not guaranteed permanent; backups are necessary (durable storage is best-effort).
- File System Access sync and periodic background reminders are browser/platform-dependent; manual backup merge remains the fallback.
- Dev dependency audit reports **17 vulnerabilities (2 low, 12 moderate, 1 high, 2 critical) in toolchain/dev packages only** (not shipped runtime). `npm audit fix` (non-force) does not clear them; `npm audit fix --force` is **not safe here** (produces incompatible `vite@8`/`vitest@5` vs current `@vitejs/plugin-react`/`vite-plugin-pwa` and breaks install/build). Controlled major upgrades with full regression are required.

## Recommended next work
- **High (audit register S1/S2): DONE** — relative KDF downgrade rejection on sync adoption and Argon2 worker timeout/bounds with tests (see above).
- Controlled, compatibility-tested dev toolchain upgrades: **DONE for the safe major line** (Vite 7 / Vitest 4 / plugin-react 5 / PWA 1.3 / ESLint 9 / TS 5.9). Going to Vite 8 / Vitest 5 / plugin-react 6 / PWA 2 / React 19 / Tailwind 4 / TypeScript 7 is blocked: `typescript-eslint` 8.x requires TypeScript `<6.1.0`, and Tailwind 4 is a config-format migration. Not pursued because the remaining advisories are `workbox-build`/`typescript-eslint` transitives unaffected by Vite 8.
- Full Playwright e2e + axe (desktop & phone) — **PASS (68/68; axe now at WCAG 2.2 AA)**. Remaining: manual a11y (WCAG 2.2 AA), device/passkey, and cloud-folder compatibility testing.
- **CI action pinning (R3): DONE** — all workflow `uses:` pinned to 40-hex commit SHAs (checkout 4.4.0, setup-node 4.4.0, upload-artifact 4.6.2, codeql-action 3.39.3); `npm run lint:actions` (`scripts/check-action-pins.mjs`) fails CI on any unpinned reference.
- Independent security audit before production/security claims.

## Pinning CI actions (exact command)

After review, pin each `uses:` to a 40-char commit SHA. On a machine with `git` and network access:

```bash
# For each action reference, resolve and verify the tag maps to a commit, then pin:
git ls-remote --tags https://github.com/actions/checkout.git refs/tags/v4^{}   # prints the SHA for v4
# e.g. actions/checkout@v4  -> uses: actions/checkout@<sha> # v4.2.2
#       actions/setup-node@v4 -> uses: actions/setup-node@<sha> # v4.x
#       actions/upload-artifact@v4 -> uses: actions/upload-artifact@<sha>
#       github/codeql-action/{init,autobuild,analyze}@v3 -> uses: ...@<sha>
```

Add a CI step that fails if any `uses:` is not `@<40-hex>` to prevent regression (e.g. a small script or `actionlint` rule).
