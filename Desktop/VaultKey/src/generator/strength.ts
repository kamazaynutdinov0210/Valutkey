import { passphraseEntropyBits } from './passphrase'
import { passwordEntropyBits } from './password'
import type { GeneratorSettings } from './index'

export interface Strength {
  bits: number
  level: 0 | 1 | 2 | 3 | 4
  label: string
  /** Plain-language guess time for an attacker holding a stolen copy and fast hardware. */
  crackTime: string
  hint?: string
}

// Policy: bits of entropy at which each level ends.
const LEVELS = [
  { below: 40, label: 'Very weak' },
  { below: 60, label: 'Weak' },
  { below: 75, label: 'Okay' },
  { below: 100, label: 'Strong' },
  { below: Infinity, label: 'Very strong' },
] as const

// Assumes 1 trillion guesses per second and that the attacker needs half the space on average.
const GUESSES_PER_SECOND = 1e12
const TIMES = [
  { maxSeconds: 1, text: 'in under a second' },
  { maxSeconds: 60, text: 'in seconds' },
  { maxSeconds: 3600, text: 'in minutes' },
  { maxSeconds: 86_400, text: 'in hours' },
  { maxSeconds: 86_400 * 30, text: 'in days' },
  { maxSeconds: 86_400 * 365, text: 'in months' },
  { maxSeconds: 86_400 * 365 * 100, text: 'in years' },
  { maxSeconds: 86_400 * 365 * 10_000, text: 'in centuries' },
] as const

export function crackTime(bits: number): string {
  const log10Seconds = (bits - 1) * Math.log10(2) - Math.log10(GUESSES_PER_SECOND)
  const found = TIMES.find((t) => log10Seconds < Math.log10(t.maxSeconds))
  return found ? found.text : 'not in practice'
}

export function strengthFromBits(bits: number, hint?: string): Strength {
  const safe = Number.isFinite(bits) && bits > 0 ? bits : 0
  const index = LEVELS.findIndex((l) => safe < l.below)
  const level = (index < 0 ? 4 : index) as Strength['level']
  return { bits: Math.floor(safe), level, label: LEVELS[level].label, crackTime: crackTime(safe), hint }
}

/** For generated secrets the entropy is exact, so no guessing model is needed. */
export function rateGenerated(settings: GeneratorSettings): Strength {
  return strengthFromBits(
    settings.mode === 'password' ? passwordEntropyBits(settings) : passphraseEntropyBits(settings),
  )
}

type Estimator = typeof import('@zxcvbn-ts/core').zxcvbn
let estimator: Promise<Estimator> | undefined

// Loaded on first use: the dictionaries are large and only needed for typed passwords.
function loadEstimator(): Promise<Estimator> {
  estimator ??= (async () => {
    const [core, common, en] = await Promise.all([
      import('@zxcvbn-ts/core'),
      import('@zxcvbn-ts/language-common'),
      import('@zxcvbn-ts/language-en'),
    ])
    core.zxcvbnOptions.setOptions({
      translations: en.translations,
      graphs: common.adjacencyGraphs,
      dictionary: { ...common.dictionary, ...en.dictionary },
    })
    return core.zxcvbn
  })()
  return estimator
}

/**
 * Rates a password the person typed. Pattern-aware (words, keyboard walks, dates, repeats),
 * because "Password1!" has a big character pool but is guessed almost immediately.
 * `userInputs` are things like the entry title or username, which attackers try first.
 */
export async function ratePassword(password: string, userInputs: string[] = []): Promise<Strength> {
  if (password.length === 0) return strengthFromBits(0)
  const zxcvbn = await loadEstimator()
  const result = zxcvbn(password.slice(0, 100), userInputs)
  const bits = result.guessesLog10 * Math.log2(10)
  return strengthFromBits(bits, result.feedback.warning || result.feedback.suggestions[0])
}
