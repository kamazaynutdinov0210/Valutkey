import { session } from '../vault/instance'
import { secretClipboard } from './clipboard'

/** Locks the vault and wipes any copied secret from the clipboard. */
export function lockVault(): void {
  void secretClipboard().clearNow()
  session.lock()
}
