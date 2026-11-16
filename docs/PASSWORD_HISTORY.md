# Password History

## Security

- Historical passwords are stored inside the encrypted entry record (AES-256-GCM).
- No plaintext history in storage, logs, analytics, or notifications.
- Updating a password pushes the previous value into `history` (capped at 20, newest first).
- Failed updates must not corrupt existing history.
- Deleting an account creates a tombstone with empty history.

## Operations

- Restore a previous version: re-encrypts the entry and records a new history event.
- Export/import preserve encrypted history.

## Verification

- History remains decryptable with the intended vault key.
- No plaintext password appears in serialized metadata.