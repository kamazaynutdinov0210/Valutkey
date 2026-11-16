# VaultKey — Complete Project Audit (Phase 0)

> **Status:** Baseline audit performed against the repository at branch `main` (commit `4b61c3a`) plus the working-tree changes delivered in the M9–M18 session. No independent security audit exists. Automated tests passing is **not** proof of cryptographic security.

## 1. Architecture summary (verified)

- **Runtime:** React 18 + TypeScript 5.9 + Vite 7 + Tailwind 3; IndexedDB (ciphertext + non-secret header); Web Crypto (AES-256-GCM, HKDF-SHA-256); Argon2id via `hash-wasm` in a Web Worker; `vite-plugin-pwa` 1.3 (injectManifest); Vitest 4; Playwright 1.65.
- **Trust boundary:** all decryption is local. No backend, no accounts, no analytics. A cloud folder only ever stores ciphertext.
- **Key hierarchy:** `master password + salt -> Argon2id -> masterSecret -> HKDF("auth") verifier / HKDF("kek") KEK`; random Vault Key wrapped by KEK, recovery key, and (optionally) WebAuthn PRF secret. Entry JSON sealed with AES-256-GCM (AAD = vaultId|id|v).
- **Layers:** `crypto/` (only module touching `crypto.subtle`/Argon2), `vault/`, `sync/`, `reminders/`, `generator/`, `unlock/`, `tools/`, `security/` (activity/breach), `ui/` (React, never touches raw keys).

## 2. Verified state (this session)

- `npm run typecheck` PASS; `npm run lint` PASS; `npm test` 275/275 PASS; `npm run build` PASS; `npm run build:e2e` PASS; full Playwright (desktop + phone-360) 68/68 PASS; `npm run audit:prod` = 0 vulnerabilities.
- Dev-toolchain `npm audit` = 17 vulns (2 low, 12 mod, 1 high, 2 crit) — **not shipped**. After the M18 upgrade: **12 (2 low, 10 moderate), 0 high/critical**, all dev/build transitives of `workbox-build`/`typescript-eslint`.

## 3. Issue register

Severity: **Critical / High / Medium / Low**. "Location" is the primary file. Testing notes reference existing or to-be-added suites.

### 3.1 Security / cryptography

| ID | Issue | Location | Severity | Why it matters | Recommended fix | Risks/deps | Test |
|----|-------|----------|----------|----------------|-----------------|------------|------|
| S1 | No KDF anti-downgrade policy on imported/adopted headers | `crypto/wrap.ts`, `crypto/kdf.ts`, `sync/restore.ts` | High | A malicious/old header could adopt weak Argon2 params, weakening offline-guess resistance | Validate imported KDF params against a minimum policy; require explicit confirmation for weaker-but-supported params; document supported versions | Must not reject existing vaults; migration UX | Unit: reject too-low mem/iterations; accept legacy; header-adopt tests |
| S2 | Argon2 memory/timeout not bounded before processing untrusted headers | `crypto/argon2.worker.ts`, `crypto/argon2Client.ts` | High | Imported header with huge `memKiB` could hang/crash device | Enforce max mem/iterations/time; cancel worker on timeout; surface friendly error | Worker lifecycle changes | Unit: excessive params rejected; worker failure path |
| S3 | JS cannot guarantee memory erasure of strings | `crypto/ct.ts`, session/entries | Medium | Decrypted passwords may persist until GC | Keep byte-wipe where possible; document limitation; minimize lifetimes | None (documented limit) | Doc + code review |
| S4 | Activity log stored in `meta` when unlocked-vault context unavailable (plaintext metadata) | `security/activityStore.ts` | Low | Metadata only, but readable by local attacker when no vault key | Prefer encrypted sealed record whenever vault key present; keep metadata-only guarantee | None | Unit: no secrets stored |
| S5 | CSP `connect-src` includes `api.pwnedpasswords.com` | `security-headers.ts` | Low | Widens network egress surface (opt-in only) | Keep consent-gated, k-anonymity; document; keep HIBP only | Requires consent | Header test asserts exact policy |

**Status:** S1 and S2 are **fixed** (see "Fixes & hardening" in `SECURITY_AUDIT.md`): sync auto-adoption rejects a weaker KDF (`weak-header`), and the Argon2 worker has a 60s timeout plus in-worker bounds. S3/S4/S5 remain documented limitations/design choices.

### 3.2 Functional / data integrity

| ID | Issue | Location | Severity | Why | Fix | Risk | Test |
|----|-------|----------|--------|-----|-----|------|------|
| F1 | No restore preview/diff before commit | `sync/restore.ts`, `ui/screens/Restore.tsx` | Medium | User replaces vault without seeing what will change | Add preview (counts, vault id) + confirm | UX work | E2E restore flow |

**Status:** F1 is **not applicable as written** — `restoreFromText` only runs onto a device with no vault (new device / cleared storage), and the destructive `replaceFromText` is not wired into any UI path. No live replace-over-existing-vault flow exists to preview. If a "replace this vault" UI is added later, it must preview counts/vault id and confirm first.
| F2 | No dashboard; no secure notes / identity / wifi categories | `ui/screens/*`, `vault/entry.ts` | Medium | Feature gap vs. product goal | Add dashboard + category presets; keep entry model compatible | Schema/versioning | Unit + E2E |
| F3 | No archive/duplicate entry actions | `vault/entries.ts`, `ui/vault/*` | Low | Missing CRUD conveniences | Add `archivedAt`, duplicate | Model extension | Unit |
| F4 | Large vaults render full list (no virtualization) | `ui/vault/EntryList.tsx` | Low | Perf on very large vaults | Virtualize when > N items | Perf work | Perf note |
| F5 | Dev toolchain had 17 CVEs | `package.json`/lock | Medium | Supply-chain hygiene | Controlled major upgrade (no `--force`) | Peer deps | Full regression |

**Status:** F5 is **fixed to the safe major line** — Vite 7.3 / Vitest 4.1 / `@vitejs/plugin-react` 5.2 / vite-plugin-pwa 1.3 / ESLint 9.39 / `typescript-eslint` 8.72 / TypeScript 5.9 / Playwright 1.65; all high/critical cleared, 12 low/moderate dev transitives remain (documented). Full regression PASS (275 unit, 68 e2e).

### 3.3 UI/UX / accessibility

| ID | Issue | Location | Severity | Why | Fix | Risk | Test |
|----|-------|----------|--------|-----|-----|------|------|
| U1 | Navigation IA not grouped (MAIN/SECURITY/MANAGEMENT) | `ui/shell/Shell.tsx` | Low | Discoverability | Group nav; add dashboard route | Restructure | E2E nav |
| U2 | No loading skeletons / toasts | various | Low | Perceived quality | Add skeletons/toast | None | Visual/E2E |
| U3 | WCAG target is 2.1 AA (prompt asks 2.2 AA) | `tests/e2e/a11y.spec.ts` | Medium | Standard gap | Extend axe tags to `wcag22aa` | May surface new issues | axe |

**Status:** U3 is **fixed** — the axe suite now scans `wcag2a/2aa/21a/21aa/22a/22aa`; all screens pass in light/dark on desktop and phone-360 (no 2.2-specific violations).
| U4 | Icons/logo/social preview minimal | `public/` | Low | Brand | Add icons/preview | Asset work | Manual |

### 3.4 Repository / process

| ID | Issue | Location | Severity | Why | Fix | Risk | Test |
|----|-------|----------|--------|-----|-----|------|------|
| R1 | No LICENSE/SECURITY/CONTRIBUTING/CODE_OF_CONDUCT/CHANGELOG | repo root | High (for public release) | Legal/trust/contrib | Add files | License choice needed | N/A |
| R2 | No issue/PR templates, Dependabot, CodeQL | `.github/` | Medium | Contribution/security process | Add | N/A | N/A |
| R3 | CI uses tag pins, no concurrency, no artifacts | `.github/workflows/ci.yml` | Medium | Reproducibility/security | Pin SHAs, add concurrency, upload reports | Verify SHAs | CI |

**Status:** R3 is **fixed** — `ci.yml` and `codeql.yml` pin every action to a 40-hex commit SHA, add `concurrency` and artifact upload; `npm run lint:actions` enforces pinning in CI.
| R4 | No `.editorconfig`/`.gitattributes`; `.gitignore` minimal | root | Low | Consistency | Add | N/A | N/A |
| R5 | No `docs/COMPLETE_PROJECT_AUDIT.md` | docs | Medium | This document | Created | N/A | N/A |

### 3.5 Documentation consistency

| ID | Issue | Location | Severity | Why | Fix |
|----|-------|----------|--------|-----|-----|
| D1 | `MILESTONES.md` stops at M8; M9–M18 undocumented there | `docs/MILESTONES.md` | Medium | Stale vs implementation | Extend table |
| D2 | `SECURITY_AUDIT.md` must state "no independent audit" | `docs/SECURITY_AUDIT.md` | High | Prevent false claims | Keep explicit notice (present) |
| D3 | No `RELEASE_PROCESS.md` | docs | Medium | Release hygiene | Add |

## 4. Licensing decision (documented)

**Chosen: MIT License.** Rationale: a security-focused, offline password manager benefits from maximum transparency and reuse; MIT is permissive, widely understood, and compatible with the existing dependency licenses. Alternative considered: AGPL-3.0 (stronger copyleft, but discourages some integrations and is heavier for a client-only PWA). **Action:** commit `LICENSE` (MIT) with the copyright holder set to the repository owner; confirm holder name before public release.

## 5. Items requiring your decision / cannot be done safely here

- **Online accounts / Google / email auth:** would require a backend + threat model + encryption-key architecture and breaks offline-first default. **Do not implement** without explicit approval; safe alternative documented (device-local identity only; cloud is ciphertext-only).
- **LICENSE copyright holder name** (owner legal name) — confirm.
- **Independent audit** — external engagement.
- **Real-device/passkey/cloud-provider QA** — physical hardware.

## 6. Phasing

This audit maps to Phase 0. Phase 1 (repo cleanup) is being executed in the same change set: LICENSE, SECURITY.md, CONTRIBUTING.md, CODE_OF_CONDUCT.md, CHANGELOG.md, templates, Dependabot, CodeQL, `.editorconfig`, `.gitattributes`, `.gitignore`, and hardened CI.