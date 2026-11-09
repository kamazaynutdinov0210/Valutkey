export interface GeneratedSecret {
  value: string
  /** Exact number of bits of randomness, assuming the attacker knows the settings. */
  entropyBits: number
}
