# Release process

This document describes how a VaultKey release is cut. **Do not publish until an independent security review has been completed if you make any "secure/audited" claim.** VaultKey is currently a release candidate.

## 1. Preconditions

- Working tree clean; all quality gates green:
  ```powershell
  npm ci
  npm run lint
  npm run typecheck
  npm test
  npm run build
  npm run audit:prod
  npx playwright install
  npm run build:e2e
  npx playwright test
  ```
- `docs/SECURITY_AUDIT.md`, `CHANGELOG.md`, and `docs/MILESTONES.md` updated for the version.
- No new high/critical production dependency advisories (dev-toolchain advisories must be documented with mitigation).

## 2. Versioning

Follow SemVer. Pre-release: `1.0.0-rc.N`. Stable: `1.0.0`.
Bump `"version"` in `package.json` and the app version shown in Settings.

## 3. Build & checksums

```powershell
npm run build
Get-FileHash dist\**\* -Algorithm SHA256   # or: sha256sum on POSIX
```

Record the SHA-256 of the built artifacts (`dist/`) in the release notes.

## 4. SBOM

Generate a Software Bill of Materials (CycloneDX or SPDX) from `package-lock.json`, e.g. with `npx @cyclonedx/cyclonedx-npm --output-file sbom.json`.

## 5. Provenance / attestation

When publishing binaries (if any), attach build provenance (e.g. `actions/attest-build-provenance` in CI, or `npm provenance`). For the PWA, provenance covers the source commit and build environment.

## 6. Tag & GitHub release

```powershell
git tag -a v1.0.0 -m "VaultKey 1.0.0"
git push origin v1.0.0
```

Create a GitHub Release from the tag with:
- Release notes (features/fixes/security from `CHANGELOG.md`).
- Checksums file and SBOM attached.
- Explicit statement about audit status.

## 7. Deployment headers

Verify the host serves the headers from `dist/_headers` (CSP, HSTS, etc.). Confirm `connect-src` matches the opt-in breach-check policy only.

## 8. Post-release

- Announce with the audit-status caveat.
- Monitor security advisories (Dependabot, CodeQL) and the private vuln reporting channel.