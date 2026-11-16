# Contributing to VaultKey

Thanks for your interest. VaultKey is a security-sensitive, offline-first password manager. Please read this before opening a pull request.

## Ground rules

- **Do not** open public issues for security vulnerabilities — see [SECURITY.md](SECURITY.md).
- **Do not** weaken cryptography, weaken CSP/headers, or introduce a backend without prior discussion in an issue.
- Keep security-sensitive logic out of React components; keep `crypto/`, `vault/`, `sync/`, `security/` pure TypeScript with unit tests.
- No new runtime dependencies without justification.

## Development setup

```powershell
# Node.js 20+
npm install
npm run dev            # dev server
npm run build          # typecheck + production build
npm run preview        # serve dist at http://localhost:4173
```

## Quality gates (must pass before merge)

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npm run audit:prod
npx playwright install
npm run build:e2e
npx playwright test
```

CI runs these plus CodeQL. Keep tests deterministic; do not weaken assertions to make CI green.

## Commit & PR conventions

- Conventional-ish subject: `type(scope): summary` (e.g. `fix(sync): keep unreadable records on merge`).
- Reference issues with `Fixes #123`.
- Describe **what changed, why, test evidence, and any security impact**.
- Screenshots for UI changes.

## Code style

- TypeScript strict; no `any` in new code without justification.
- No comments explaining *what*; comments explain *why* for non-obvious security decisions.
- Preserve the existing four-screen/then-expanded navigation structure; reuse screens before adding new ones.

## Adding features

Open an issue first for: new crypto, new auth (online accounts), new storage schemas (migrations), or new network calls. These change the threat model and need explicit review.

## License

By contributing you agree your contributions are licensed under the project's [MIT License](LICENSE).