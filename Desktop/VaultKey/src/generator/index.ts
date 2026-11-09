import { GeneratorError } from './errors'
import {
  DEFAULT_PASSPHRASE_SETTINGS,
  generatePassphrase,
  validatePassphraseSettings,
  type PassphraseSettings,
} from './passphrase'
import {
  DEFAULT_PASSWORD_SETTINGS,
  generatePassword,
  validatePasswordSettings,
  type PasswordSettings,
} from './password'
import { secureFill, type FillFn } from './random'
import type { GeneratedSecret } from './types'

export type GeneratorSettings = PasswordSettings | PassphraseSettings

export function generate(settings: GeneratorSettings, fill: FillFn = secureFill): GeneratedSecret {
  return settings.mode === 'password'
    ? generatePassword(settings, fill)
    : generatePassphrase(settings, undefined, fill)
}

export function defaultSettings(mode: GeneratorSettings['mode']): GeneratorSettings {
  return mode === 'password' ? { ...DEFAULT_PASSWORD_SETTINGS } : { ...DEFAULT_PASSPHRASE_SETTINGS }
}

/** Validates settings read back from storage (they were saved with an entry; never trust their shape). */
export function parseSettings(raw: unknown): GeneratorSettings {
  if (typeof raw !== 'object' || raw === null) throw new GeneratorError('Saved generator settings are damaged.')
  const r = raw as Record<string, unknown>
  if (r.mode === 'password') {
    const s: PasswordSettings = {
      mode: 'password',
      length: Number(r.length),
      upper: r.upper === true,
      lower: r.lower === true,
      digits: r.digits === true,
      symbols: r.symbols === true,
      excludeLookalikes: r.excludeLookalikes === true,
    }
    validatePasswordSettings(s)
    return s
  }
  if (r.mode === 'passphrase') {
    const s: PassphraseSettings = {
      mode: 'passphrase',
      words: Number(r.words),
      separator: typeof r.separator === 'string' ? r.separator : '-',
      capitalize: r.capitalize === true,
      includeNumber: r.includeNumber === true,
    }
    validatePassphraseSettings(s)
    return s
  }
  throw new GeneratorError('Saved generator settings are damaged.')
}

export { GeneratorError } from './errors'
export { passphraseEntropyBits, type PassphraseSettings } from './passphrase'
export { passwordEntropyBits, type PasswordSettings } from './password'
export { rateGenerated, ratePassword, strengthFromBits, type Strength } from './strength'
export type { GeneratedSecret } from './types'
