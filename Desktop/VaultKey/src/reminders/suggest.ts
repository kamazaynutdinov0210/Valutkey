import { generate, type GeneratedSecret } from '../generator'
import type { FillFn } from '../generator/random'
import type { Entry } from '../vault/entry'

/** A new password made with this entry's own saved settings. It is only a suggestion until confirmed. */
export function suggestPassword(entry: Entry, fill?: FillFn): GeneratedSecret {
  let suggestion = generate(entry.generator, fill)
  for (let i = 0; i < 5 && suggestion.value === entry.password; i++) suggestion = generate(entry.generator, fill)
  return suggestion
}
