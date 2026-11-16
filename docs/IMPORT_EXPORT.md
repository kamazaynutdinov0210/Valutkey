# Import and Export

## Encrypted backup/restore
- Existing `.vaultkey` encrypted backup/restore remains supported. Files contain the vault header, ciphertext records, and a sealed manifest; they open only with the file’s master password or recovery key.
- Restores/replacements require integrity checks and explicit confirmation before destructive actions.

## CSV import (in progress)
- Supports parsing/mapping/preview foundations for generic and Bitwarden-compatible CSV headers; 1Password/KeePass-compatible exports are handled only where mappings are reliable (verify per file in preview).
- Import flow: parse → map columns → preview records → detect duplicates/invalid rows/unsafe URL schemes → user selects records → encrypt and store. No plaintext temp files should be retained.
- **Do not claim compatibility with a format that has not been tested.** Always review preview.

## Privacy
- Imported data is encrypted immediately into the local vault. No external service is used for import.
