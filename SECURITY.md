# Security Policy

## Supported versions

| Version | Supported |
|---|---|
| 1.0.x (release candidate) | Security fixes |
| < 1.0 | Not supported |

## Reporting a vulnerability

**Do not open a public issue for security bugs.**

Report privately via GitHub Security Advisories ("Report a vulnerability" on the repo's Security tab) or email the maintainer listed in the repository profile. Please include:

- A description and impact.
- Steps to reproduce (proof of concept if possible).
- Affected version/commit.
- Any suggested mitigation.

We aim to acknowledge within **7 days** and to provide a fix or mitigation plan within **30 days** for confirmed issues. We will credit reporters who want it.

## Threat model & scope

Read [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md) and [docs/SECURITY_AUDIT.md](docs/SECURITY_AUDIT.md). In scope: cryptographic design, key handling, session/lock, WebAuthn PRF, backup/sync integrity, CSP/headers, service worker, dependency CVEs in shipped code.

**Out of scope:** attacks requiring a compromised device/endpoint, physical keyloggers, malicious browser extensions, social engineering, or a user's own weak master password. VaultKey has **not** had an independent cryptographic audit; do not treat it as production-hardened.

## Security-relevant dependency policy

- Production dependencies are audited in CI (`npm run audit:prod`, `--audit-level=high`); the build fails on high/critical.
- Dev-toolchain advisories are tracked; upgrades are applied only via compatibility-tested changes (never `npm audit fix --force`, which is known to break the pinned Vite/Vitest/plugin set).

## Hardening notes

- CSP and headers are single-sourced in `security-headers.ts` and emitted to `dist/_headers`; verify on your host.
- Breach checking is opt-in, consent-gated, k-anonymity only (5-char SHA-1 prefix). SHA-1 is used only for that lookup protocol, never for vault encryption.