import { GeneratorError } from './errors'
import { randomInt, secureFill, type FillFn } from './random'
import type { GeneratedSecret } from './types'
import { WORDLIST } from './wordlist'

export const PASSPHRASE_WORDS = { min: 3, max: 20 } as const

export interface PassphraseSettings {
  mode: 'passphrase'
  words: number
  separator: string
  capitalize: boolean
  includeNumber: boolean
}

export const DEFAULT_PASSPHRASE_SETTINGS: PassphraseSettings = {
  mode: 'passphrase',
  words: 6,
  separator: '-',
  capitalize: false,
  includeNumber: false,
}

export function validatePassphraseSettings(settings: PassphraseSettings): void {
  const { min, max } = PASSPHRASE_WORDS
  if (!Number.isInteger(settings.words) || settings.words < min || settings.words > max) {
    throw new GeneratorError(`Choose from ${min} to ${max} words.`)
  }
  if (typeof settings.separator !== 'string' || settings.separator.length > 3) {
    throw new GeneratorError('The separator can be up to 3 characters.')
  }
}

/** words x log2(list size); a random digit on a random word adds log2(words x 10). */
export function passphraseEntropyBits(settings: PassphraseSettings, listSize: number = WORDLIST.length): number {
  validatePassphraseSettings(settings)
  const base = settings.words * Math.log2(listSize)
  return settings.includeNumber ? base + Math.log2(settings.words * 10) : base
}

export function generatePassphrase(
  settings: PassphraseSettings,
  list: readonly string[] = WORDLIST,
  fill: FillFn = secureFill,
): GeneratedSecret {
  validatePassphraseSettings(settings)
  const words: string[] = []
  for (let i = 0; i < settings.words; i++) {
    const word = list[randomInt(list.length, fill)] ?? ''
    words.push(settings.capitalize ? word.charAt(0).toUpperCase() + word.slice(1) : word)
  }
  if (settings.includeNumber) {
    const index = randomInt(words.length, fill)
    words[index] = (words[index] ?? '') + String(randomInt(10, fill))
  }
  return { value: words.join(settings.separator), entropyBits: passphraseEntropyBits(settings, list.length) }
}
