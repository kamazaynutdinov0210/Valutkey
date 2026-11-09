import { countValid, log2Big } from './entropy'
import { GeneratorError } from './errors'
import { randomInt, secureFill, type FillFn } from './random'
import type { GeneratedSecret } from './types'

export const CHARSETS = {
  lower: 'abcdefghijklmnopqrstuvwxyz',
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  digits: '0123456789',
  symbols: '!@#$%^&*()-_=+[]{};:,.?/~',
} as const

/** Characters that are easy to confuse when read aloud or copied by hand. */
export const LOOKALIKES = '0Oo1lI|'

export const PASSWORD_LENGTH = { min: 8, max: 128 } as const

export interface PasswordSettings {
  mode: 'password'
  length: number
  upper: boolean
  lower: boolean
  digits: boolean
  symbols: boolean
  excludeLookalikes: boolean
}

export const DEFAULT_PASSWORD_SETTINGS: PasswordSettings = {
  mode: 'password',
  length: 20,
  upper: true,
  lower: true,
  digits: true,
  symbols: true,
  excludeLookalikes: false,
}

/** The enabled character classes (look-alikes removed if requested). */
export function characterClasses(settings: PasswordSettings): string[] {
  const kinds = ['lower', 'upper', 'digits', 'symbols'] as const
  return kinds
    .filter((kind) => settings[kind])
    .map((kind) =>
      settings.excludeLookalikes ? [...CHARSETS[kind]].filter((c) => !LOOKALIKES.includes(c)).join('') : CHARSETS[kind],
    )
}

export function validatePasswordSettings(settings: PasswordSettings): string[] {
  const { min, max } = PASSWORD_LENGTH
  if (!Number.isInteger(settings.length) || settings.length < min || settings.length > max) {
    throw new GeneratorError(`Choose a length from ${min} to ${max}.`)
  }
  const classes = characterClasses(settings)
  if (classes.length === 0) throw new GeneratorError('Choose at least one kind of character.')
  return classes
}

/** Exact entropy: log2 of the number of passwords that satisfy "every chosen kind appears". */
export function passwordEntropyBits(settings: PasswordSettings): number {
  const classes = validatePasswordSettings(settings)
  return log2Big(countValid(settings.length, classes.map((c) => c.length)))
}

/**
 * Picks every character independently and uniformly from the full pool, and starts over
 * if a chosen kind is missing. (Forcing one character per kind and shuffling would
 * be simpler, but it makes some passwords more likely than others.)
 */
export function generatePassword(settings: PasswordSettings, fill: FillFn = secureFill): GeneratedSecret {
  const classes = validatePasswordSettings(settings)
  const pool = classes.join('')
  for (let attempt = 0; attempt < 10_000; attempt++) {
    let value = ''
    for (let i = 0; i < settings.length; i++) value += pool.charAt(randomInt(pool.length, fill))
    const used = new Set(value)
    if (classes.every((kind) => [...kind].some((c) => used.has(c)))) {
      return { value, entropyBits: passwordEntropyBits(settings) }
    }
  }
  throw new GeneratorError('Could not make a password. Please try again.')
}
