# Privacy

VaultKey is local-first and account-free by default.

## Stored/encrypted
- Vault entries (titles, usernames, URLs, passwords, notes, tags, history, metadata) are encrypted locally (AES-256-GCM) under keys derived via Argon2id/HKDF.
- Device-local state may include encrypted device-unlock records (WebAuthn PRF), sync state handles, and optional reminder hints (next due date only, no entry names).

## Not sent by default
- No vault data is sent to any server. CSP restricts network egress.

## Optional breach checking
- If explicitly enabled by the user, VaultKey may check passwords against the Have I Been Pwned Pwned Passwords range API using **k-anonymity**.
- Only the first 5 characters of a SHA-1 hash are transmitted; suffix matching is local. The original password is never transmitted.
- SHA-1 is used **only** for this compatibility protocol, not for vault encryption.
- The feature is optional, requires consent, and handles offline/failure without affecting the vault.

## Security limitations
No independent audit completed. JS memory wiping is not guaranteed. See `docs/SECURITY_AUDIT.md` and `docs/THREAT_MODEL.md`.
