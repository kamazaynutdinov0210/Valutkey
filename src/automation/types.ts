/** Automation capabilities an integration may declare. Never claim more than the provider actually supports. */
export type AutomationCapability =
  | 'official-api'
  | 'account-api'
  | 'oauth'
  | 'assisted'
  | 'manual'
  | 'unsupported'

export type AutomationMode = 'manual' | 'assisted' | 'automatic'

export interface IntegrationDescriptor {
  id: string
  name: string
  capabilities: AutomationCapability[]
  /** True only when an official, documented provider integration can perform the change without user interaction. */
  supportsAutomatic: boolean
}

export interface PasswordChangeRequest {
  entryId: string
  currentPassword: string
  newPassword: string
  username?: string
  url?: string
}

export interface PasswordChangeResult {
  ok: boolean
  message: string
  /** Provider confirmation reference, if any. */
  reference?: string
}

export interface PasswordChangeAdapter {
  descriptor: IntegrationDescriptor
  /** Whether this adapter can perform an automatic change right now (auth + capability). */
  canAutomate(): boolean
  requestChange(request: PasswordChangeRequest): Promise<PasswordChangeResult>
}