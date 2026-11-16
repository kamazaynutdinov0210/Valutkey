import type { PasswordChangeAdapter, PasswordChangeRequest, PasswordChangeResult } from './types'
import { globalRegistry } from './registry'

/** Manual adapter: never changes anything remotely; always hands control back to the user. */
const manualAdapter: PasswordChangeAdapter = {
  descriptor: {
    id: 'manual',
    name: 'Manual (user-assisted)',
    capabilities: ['manual', 'assisted'],
    supportsAutomatic: false,
  },
  canAutomate() {
    return false
  },
  async requestChange(_request: PasswordChangeRequest): Promise<PasswordChangeResult> { void _request
    return { ok: false, message: 'Automatic change is not supported for this account. Use the provider’s official change page.' }
  },
}

globalRegistry.register(manualAdapter)

export { manualAdapter }