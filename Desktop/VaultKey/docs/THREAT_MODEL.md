# Threat model

VaultKey is a zero-knowledge, offline-first password manager. All encryption and decryption happen in your browser. There is no server that holds your data.
This document says what is protected, from whom, and what is not.

## 1. What is being protected
Your saved entries (titles, usernames, websites, passwords, notes, tags, history, reminder settings) and the keys that lock them.

## 2. Who it protects against
| Threat | Protected? | How |
|---|---|---|
| Someone copies this browser's stored data | Yes, if your master password is strong | Entries are AES-256-GCM ciphertext. The key needs the master password (Argon2id, 64 MiB, 3 passes) or the recovery key. |
| A cloud service or anyone who obtains a backup or sync file | Yes, if your master password is strong | Same ciphertext. The file also holds what is needed to *test* password guesses offline, so the master password is the whole defence. |
| Someone edits, removes, swaps or replays parts of a backup or sync file | Yes (detected) | A sealed manifest fingerprints every entry and the header; entries are bound to their vault and id. A replayed *older but genuine* file is detected by a revision number and warned about. |
| A website or script reading data out of the app | Largely | Strict Content Security Policy: no inline scripts, no `eval`, same-origin only, no framing. No third-party code runs. |
| Shoulder-surfing, a phone left unattended | Partly | Auto-lock (1-15 minutes, and on close), passwords hidden by default, 30-second clipboard clear. |
| Someone guessing your master password on your device | Slows them | Each guess costs about a second. There is no lockout counter. |
| A lost device | Yes, if locked | Data is encrypted at rest. Device unlock (if on) works only on that device with its fingerprint, face or PIN. |

## 3. What it does NOT protect against
- **Malware, keyloggers, a rooted or compromised device, hostile browser extensions.** Anything that can read the page while unlocked can read your passwords.
- **A compromised host serving malicious code.** A web app is delivered fresh. Mitigations: strict CSP, no third-party scripts, exact dependency versions, a dependency audit, updates applied only when you restart. VaultKey cannot verify the code it receives. Use HTTPS and a trusted host.
- **A weak master password.** Setup requires 12+ characters and an "Okay" rating, but a backup file can be attacked offline for as long as it exists.
- **Memory inspection while unlocked.** JavaScript cannot guarantee that secrets are wiped. The vault key is a non-extractable browser key and byte buffers are wiped, but strings (including decrypted passwords) may linger until garbage collection.
- **Someone who already learned your old master password and holds old data.** Changing the master password or recovery key re-wraps the same vault key. Only "Make a new vault key" locks everything again, and it cannot undo copies made earlier. Change the important passwords themselves.
- **Weak or reused passwords you choose yourself.** The strength meter tells you; it cannot stop you.
- **Phishing.** VaultKey does not autofill, so it cannot warn about look-alike sites.

## 4. Where data lives
| Place | Contents | Readable without the master password? |
|---|---|---|
| IndexedDB `meta.header` | vault id, Argon2 salt and settings, password verifier, vault key locked twice (password, recovery), when the password last changed | Plain JSON, but no secret. **Allows offline password guessing.** |
| IndexedDB `records` | one ciphertext per entry, with its id | No |
| IndexedDB `meta.syncState`, `syncHandle` | device id, last file revision and time, a reference to your sync file | Not secret |
| IndexedDB `meta.deviceUnlock` (opt-in) | passkey id, salt, vault key locked under the authenticator's secret, vault id | No |
| IndexedDB `meta.reminderHint` (opt-in) | the date the next reminder starts, nothing else | Yes: **leaks one date** |
| localStorage | auto-lock minutes, theme, notification choices, last notification day | Yes: not secret |
| Service worker cache | VaultKey's own program files | Yes: public code |
| Memory, while unlocked | the vault key (non-extractable), decrypted entries | n/a |
| Clipboard | a copied secret, for up to 30 seconds (and cleared on lock) | n/a |
| Backup and sync files | header + all ciphertext + a sealed manifest | Same as header and records above |

Nothing is stored on any server. Nothing is logged: lint forbids `console`, and error messages never contain secrets.

## 5. Cryptography
Argon2id (hash-wasm, WebAssembly, in a worker) -> HKDF-SHA-256 with separate labels -> a *verifier* and a *key-encrypting key*. A random 256-bit **vault key** encrypts entries
(AES-256-GCM, fresh random 96-bit IV, associated data = vault id, purpose, entry id, version). The vault key is wrapped under the master password's key and under a random 256-bit **recovery key**
(HKDF; no slow hashing needed because it already has full entropy). Constant-time comparison for the verifier. No home-made primitives: Web Crypto and the audited `hash-wasm` and `@scure/bip39` libraries only.
Details: [ARCHITECTURE.md](ARCHITECTURE.md).

## 6. Sync, backup and merge
- Files can be deleted, withheld, or replaced by whoever controls the folder. Replacing with garbage or tampering is refused; serving an older genuine copy is warned about; deleting needs your other copies, which is why backups matter.
- Two devices writing at once can lose one update (plain files have no locking, and some cloud services create "conflicted copy" files). Sync one device at a time.
- Merging compares timestamps from each device's clock. If both devices changed the same entry since the last sync, the newest wins and the older password is kept in that entry's history.
- Restoring an old backup restores the master password and recovery key as they were then.

## 7. Device unlock (fingerprint, face, PIN)
A passkey with the WebAuthn PRF extension yields a secret only that authenticator can reproduce after verifying you. VaultKey stores the vault key encrypted under it, on that device only. Turning it on needs your master password.
It is as strong as the device's lock screen, skips the slow Argon2 step, and stops working if the passkey is removed (the master password still works). It is switched off whenever the vault key changes.

## 8. Closed-app reminders (opt-in)
Browsers cannot run exact timers for a closed app. If you opt in (and your browser supports it), VaultKey keeps one value on this device, the date your next reminder starts, so a background check can show a generic notice ("At least one password is due..."). It never contains names, is never put in backups or sync files, and is cleared when you turn the option off.

## 9. Platform limits
- Browsers may delete a site's data when storage is low, and Safari may after about a week of non-use for sites that are not installed. VaultKey asks for durable storage and offers backups; neither is a guarantee.
- Clipboard clearing works only while the app is open and focused, and overwrites anything else you copied in those 30 seconds (the clipboard is never read).
- Notifications can appear on a locked screen, so they never name an entry.
- Different browsers support different features (passkey PRF, folder sync, background checks). Unsupported options are hidden or disabled rather than faked.

## 10. Known gaps and future work
- No independent security audit yet.
- No lockout or delay after repeated wrong master passwords (the cost is the Argon2 time).
- Trusted Types and a stricter worker policy were not adopted because they could not be validated across browsers.
- No scheduled automatic backups; no password-health report (reuse, breaches); no import from other password managers.
- Tested in Chromium (desktop and phone size). Safari, Firefox, real Android and iOS devices, and screen readers need manual checking.
