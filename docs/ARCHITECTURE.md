# VaultKey architecture

Everything runs in the browser. There is no backend; a cloud folder only ever holds ciphertext.

## Layers
- **ui/** React screens (Vault, Generator, Reminders, Settings). Never touches raw keys.
- **vault/, reminders/, sync/, generator/, unlock/, tools/** plain TypeScript services (no React imports, easy to test).
- **crypto/** the only code that calls `crypto.subtle` or the Argon2 WASM. Argon2 runs in a Web Worker.
- **IndexedDB** stores ciphertext and the non-secret vault header.
- **sw.ts** precaches the built files for offline use.

## Folder structure
```
src/{crypto,generator,vault,reminders,sync,unlock,tools,ui}/   sw.ts  main.tsx
tests/{unit,e2e}/   docs/   public/   security-headers.ts   vite.config.ts
```

## Key hierarchy (implemented from M1)
```
master password + salt -> Argon2id -> masterSecret
   HKDF "auth" -> verifier (stored)        HKDF "kek" -> KEK (memory only)
random Vault Key (VK) --AES-GCM wrapped by--> KEK        (wrapped.password)
                      --AES-GCM wrapped by--> recovery key (wrapped.recovery)
                      --AES-GCM wrapped by--> WebAuthn PRF secret (this device only)
Entry JSON --AES-256-GCM(VK, random IV, AAD = vaultId|id|v)--> IndexedDB / sync file
```

## Data model
`VaultHeader` (kdf params, salt, verifier, wrapped VK copies), `EncryptedRecord { id, v, iv, ct }`,
and `Entry` (title, username, url, password, notes, tags, dates, generator settings, rotation, history, deletedAt).
Full type definitions land with M1/M3 in `src/vault/`.

## Single source of truth for headers
`security-headers.ts` feeds `vite preview`, the generated `dist/_headers`, and the unit tests, so the policy we test is the policy we ship.

## M1 crypto module map (`src/crypto/`)
- `argon2.ts` hash-wasm Argon2id; `argon2.worker.ts` + `argon2Client.ts` run it off the UI thread (fresh worker per call).
- `kdf.ts` password normalization (NFKC), parameter limits, HKDF, password -> verifier + KEK.
- `aead.ts` AES-256-GCM with random IV and AAD; `records.ts` seals/opens JSON records.
- `wrap.ts` create vault, unlock (password / recovery), change password, reset via recovery.
- `recovery.ts` 256-bit recovery key, Base32 with checksum.
- `ct.ts` constant-time compare and wipe. `errors.ts` fixed-message error codes.
- Argon2 is injected (`Argon2Fn`), so tests call hash-wasm directly and the app uses the worker.

## M2 generator and tools (`src/generator/`, `src/tools/`)
- `random.ts` `randomInt` uses `crypto.getRandomValues` with rejection sampling (no modulo bias).
- `password.ts` picks every character uniformly from the pool and retries until each chosen kind appears.
  `entropy.ts` counts that space exactly (inclusion-exclusion), so the reported bits are exact.
- `passphrase.ts` picks words from a pluggable list (default: BIP-39 English, 2,048 words = 11 bits each).
- `strength.ts` generated secrets use exact entropy. Typed passwords use zxcvbn-ts (pattern-aware, loaded on demand).
  Levels: <40 Very weak, <60 Weak, <75 Okay, <100 Strong, else Very strong bits.
- `index.ts` `generate`, `parseSettings` (validates settings read back from an encrypted entry).
- `tools/hashTool.ts` SHA-256/512 (Web Crypto), bcrypt (hash-wasm), Argon2id (reuses the M1 worker). Utility only; never stores input.

## M3a app shell (`src/vault/`, `src/ui/`)
- `vault/session.ts` the only holder of the unlocked Vault Key. States: loading, no-vault, locked, unlocked. `lock()` drops the key.
  A new vault lives in memory until the recovery key is confirmed, then the header is saved.
- `vault/storage.ts` IndexedDB `meta` store holds only the vault header (salts, wrapped keys, verifier).
- `vault/idleLock.ts` inactivity timer plus a clock check for frozen background pages.
- `ui/clipboard.ts` copy with a 30 s overwrite; cleared on lock.
- `ui/prefs.ts` non-secret preferences in localStorage (auto-lock minutes, theme).
- `ui/App.tsx` picks the screen from the session state. `ui/shell/Shell.tsx` is one `<nav>`: bottom bar on phones, sidebar from 768 px.
- Dark mode follows the device with no JavaScript; choosing Light or Dark sets `data-theme` on `<html>`.

## M3b vault entries (`src/vault/`, `src/ui/vault/`)
- `entry.ts` the `Entry` type, input checks and limits, safe web links (http/https only), and `parseEntry`, which validates every
  decrypted record because decryption proves who wrote it, not that its shape is sane.
- `entries.ts` create / update / remove over encrypted records. Editing a password pushes the old one onto history (max 20).
  Deleting writes an empty tombstone, so no secret remains in storage and deletes can sync later.
- `search.ts` case-insensitive, every word must match, searches title / username / website / notes / tags, never passwords.
- `storage.ts` IndexedDB version 2 adds a `records` store (ciphertext only). Existing version 1 databases upgrade in place.
- `ui/useVault.ts` keeps decrypted entries in the Shell, so they are dropped on lock. A damaged record is counted and skipped.
- The hash tool lives in the Generator screen; the app still has exactly four screens.

## M4 rotation reminders (`src/reminders/`)
- `schedule.ts` pure calendar arithmetic on year/month/day, so daylight saving and time zones cannot shift a due date. Months clamp to the
  end of shorter months (Jan 31 + 1 month = Feb 28/29) and always count from the original date. "Due today" is "soon"; overdue starts at midnight.
- `suggest.ts` a new password from the entry's own saved generator settings. Only a suggestion: `vault.rotate()` runs after the person confirms.
- `notify.ts` opt-in notification, at most one per day, with a generic message that never names an entry. Uses the service worker where required (Android).
- The Vault tab shows a banner and the Reminders tab shows a count whenever something is due; this does not depend on notification permission.
- Entry `rotation` = `{ every, unit, lastRotatedAt }`. A new password restarts the clock; renaming or changing only the interval does not.
- Not in M4: notifications while the app is closed (they need background work in the service worker; planned for M5).

## M5 install, offline and updates (`src/pwa/`, `src/sw.ts`)
- `sw.ts` precaches every built file (including the Argon2 worker, its WebAssembly and the typed-password dictionaries), serves the app shell for any
  navigation, claims open pages on activation (offline works without a second reload), and handles notification taps and the optional periodic check.
- Updates: the new worker waits. `pwa/updates.ts` raises a banner; "Restart to update" installs it and reloads, which locks the vault. Code never changes under an unlocked vault.
- `pwa/install.ts` captures Chrome/Edge's one-time install event early; iPhone/iPad get Share-menu steps; everything else gets generic steps.
- `pwa/persist.ts` asks the browser for durable storage after setup and from Settings.
- Closed-app reminders (opt-in, off by default): `pwa/background.ts` registers a periodic background sync and keeps one value, the next reminder date,
  in the device-local `meta` store. The worker compares it with today and shows a generic notification at most once a day. It cannot read titles, entries or keys.
  The value is never part of a backup or sync file.
- `pwa/hint.ts` is the shared, dependency-free decision logic (used by both page and worker, and unit tested).

## M6 backup and sync (`src/sync/`)
- **One file format** (`.vaultkey`, JSON) for backups and sync: the vault header, every encrypted record, and a sealed manifest. Nothing is encrypted a second time: the file opens with the master password or the recovery key.
- **Manifest** (encrypted with the Vault Key): revision number, writing device, record count, a fingerprint of every (record id, IV) pair, a fingerprint of the header, and when the master password last changed.
  A cloud service cannot forge it. It can still serve an *older authentic* file, which is why each device remembers the highest revision it has seen and warns when a file is older.
- **Integrity**: removing, adding or swapping a record, or editing the header, fails the manifest check and the file is refused untouched. A record that cannot be decrypted is counted and kept, so writing the file back never destroys it.
- **Merge** is per entry, newest edit wins, deletes are kept as tombstones. If both devices changed an entry since the last sync, the newest wins and the other password is kept in history; the person is told how many conflicts there were.
- **Sync** (`service.ts`): read the file, merge, write the result back. A file that is not VaultKey's, or belongs to another vault, is left alone. The revision is only recorded after a write succeeds.
- **Folder sync** uses the File System Access API (Chromium on computers). The chosen file's handle is stored on this device. Elsewhere, backup files can be put into a cloud folder by hand.
- **Restore** (`restore.ts`): the password or recovery key must open the file's own header and the file must pass its integrity check before anything is written. The header is saved last.
- A newer master-password header (by the sealed `headerChangedAt`) is adopted from the file, so changing the password on one device carries to the others.

## M7 key management and device unlock (`src/crypto/rotate.ts`, `src/unlock/`)
- **Change master password**: re-wraps the same Vault Key under a new password key (new salt). Data is not re-encrypted. Other synced devices adopt the new header (by `changedAt`) after their next sync.
- **New recovery key**: re-wraps the same Vault Key under a new recovery key. The new header is saved only after the person confirms they stored the key.
- **New vault key**: `rotateVaultKey` makes a whole new vault (new vault id, key, salt, recovery key) and re-encrypts every record. It refuses if any record is unreadable (it would lose it).
  Header and records are replaced in one IndexedDB transaction (`idbVaultReplacer`). Sync file, sync history and device unlock are cleared, because they belong to the old vault.
  Other devices bring themselves up to date with "Replace this vault with a backup file" (`replaceFromText`).
- **Device unlock** (`device.ts`, `webauthn.ts`): a platform passkey with the WebAuthn PRF extension produces a secret only that authenticator can reproduce (after fingerprint, face or PIN).
  An HKDF of it encrypts the Vault Key; the result is stored on this device only (`meta.deviceUnlock`), tied to the vault id, never in backups or sync files.
  Turning it on needs the master password (to obtain the Vault Key) and a second passkey prompt (to prove it works). If the device cannot do PRF, nothing is saved and the option is not offered.
