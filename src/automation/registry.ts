import type { IntegrationDescriptor, PasswordChangeAdapter } from './types'

/** Central registry of password-change integrations. New providers are added here, never via DOM scraping. */
export class IntegrationRegistry {
  private adapters = new Map<string, PasswordChangeAdapter>()

  register(adapter: PasswordChangeAdapter): void {
    this.adapters.set(adapter.descriptor.id, adapter)
  }

  get(id: string): PasswordChangeAdapter | undefined {
    return this.adapters.get(id)
  }

  list(): PasswordChangeAdapter[] {
    return [...this.adapters.values()]
  }

  descriptors(): IntegrationDescriptor[] {
    return this.list().map((a) => a.descriptor)
  }

  /** The only integration guaranteed to exist: user-assisted, never automatic. */
  manual(): PasswordChangeAdapter | undefined {
    return this.adapters.get('manual')
  }
}

export const globalRegistry = new IntegrationRegistry()