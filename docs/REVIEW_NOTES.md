# Notes for an independent reviewer

VaultKey has **not** been independently audited. These notes say where to look first, what was assumed, and what has and has not been verified.

## Read these first (security-critical)
| File | Why |
|---|---|
| `src/crypto/kdf.ts`, `wrap.ts`, `recovery.ts`, `rotate.ts` | Key derivation, verifier, key wrapping, recovery key, rotation |
| `src/crypto/aead.ts`, `records.ts` | AES-GCM use: random IVs, associated data, error handling |
| `src/crypto/ct.ts`, `encoding.ts` | Constant-time compare, wiping, base64 |
| `src/vault/session.ts` | The only holder of the unlocked key; lock; replace |
| `src/sync/file.ts`, `merge.ts`, `service.ts`, `restore.ts` | Backup/sync format, integrity manifest, rollback, merge, restore ordering |
| `src/unlock/device.ts`, `webauthn.ts` | Passkey PRF use and storage |
| `src/vault/entry.ts` | Validation of decrypted data, safe links (http/https only) |
| `security-headers.ts`, `src/sw.ts` | CSP and headers, service worker scope |
| `src/generator/random.ts`, `password.ts`, `entropy.ts` | Unbiased random selection and exact entropy |

## Questions worth asking
1. Is it sound to derive both the verifier and the key-encrypting key from one Argon2 output by HKDF labels? (Intended: independent values; the verifier cannot unwrap anything.)
2. Are the associated-data strings unambiguous (`|`-joined, parts forbidden to contain `|`) and bound to every purpose (wrap, record, manifest, device)?
3. Random 96-bit IVs per record: the vault key is only ever used for a bounded number of encryptions per vault; is that margin acceptable?
4. The backup header contains a verifier, so a stolen file permits offline guessing at Argon2 cost. Is 64 MiB / 3 passes / p=1 adequate for the intended threat?
5. Manifest design: does sealing (revision, record fingerprint, header fingerprint) with the vault key stop a malicious folder from forging, reordering or truncating, apart from replaying an older genuine file?
6. Merge: can any sequence of devices, clocks and deletes lose a password silently? (Conflicts keep the older password in history; exact ties are broken deterministically.)
7. Restore ordering: records are written first and the header last; replacing the whole vault is one IndexedDB transaction.
8. PRF-based device unlock: salt handling, the choice to require the master password at set-up, behaviour when the passkey changes.
9. CSP: `script-src 'self' 'wasm-unsafe-eval'` is needed for WebAssembly. Is there anything else that could execute attacker-controlled code?
10. Memory hygiene: which secrets exist as JavaScript strings, and for how long?

## Assumptions
- The browser's Web Crypto, `crypto.getRandomValues` and IndexedDB behave as specified. The device is not compromised.
- Hosting is HTTPS with the supplied headers and serves unmodified files.
- Device clocks are roughly correct (merge uses them).

## What has been verified
- Unit tests: known-answer vectors for AES-GCM (NIST), HKDF (RFC 5869) and Argon2id (reference implementation); tamper, wrong-key, wrong-context, truncation and replay cases; generator bias and entropy; reminder dates across four time zones; merge and multi-device sync scenarios; restore failure cases that store nothing.
- Browser tests (Chromium, desktop and 360 px phone size): setup, unlock, recovery, offline, backup/restore, key rotation, a simulated passkey, strict-CSP behaviour, installability.
- Automated accessibility scans (WCAG 2.1 A/AA) of every screen in light and dark mode.
- `npm audit --omit=dev`: 0 vulnerabilities at the time of the last run. Re-run before each release.

## What has NOT been verified
- Real fingerprint/face hardware, real Android and iOS devices, Safari, Firefox, Edge.
- Real cloud folders (Dropbox, OneDrive, iCloud Drive, Google Drive) with the File System Access API.
- Screen readers in practice; Lighthouse PWA/performance scores on the deployed site.
- Closed-app background reminders (browser-dependent and not testable automatically).
- Any attack outside the browser: malware, supply-chain attacks on the build tools.

## Reporting
If you find a problem, please report it privately to the maintainer before publishing details.
