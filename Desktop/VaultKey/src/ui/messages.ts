import { CryptoError } from '../crypto/errors'
import { SyncError } from '../sync/file'

/** Plain-language messages. They never reveal more than the person needs. */
export function describeError(error: unknown): string {
  if (error instanceof CryptoError) {
    switch (error.code) {
      case 'wrong-password':
        return 'That password didn’t work. Check it and try again.'
      case 'invalid-recovery-key':
        return 'That recovery key doesn’t look right. Check for typing mistakes.'
      case 'wrong-recovery-key':
        return 'That recovery key doesn’t belong to this vault.'
      case 'corrupt':
      case 'invalid-header':
        return 'The saved vault looks damaged. If you have a backup, restore it.'
    }
  }
  if (error instanceof SyncError) {
    switch (error.code) {
      case 'not-a-vault-file':
        return 'That isn’t a VaultKey file.'
      case 'different-vault':
        return 'That file belongs to a different vault, so VaultKey left it alone.'
      case 'altered':
        return 'That file is damaged or has been changed, so VaultKey won’t use it.'
      case 'unreadable':
        return 'VaultKey couldn’t open that file with this vault’s key. It may belong to a different vault.'
      case 'newer-format':
        return 'That file was made by a newer version of VaultKey. Update VaultKey and try again.'
      case 'too-large':
        return 'That file is too large to be a VaultKey file.'
    }
  }
  return 'Something went wrong. Please try again.'
}
