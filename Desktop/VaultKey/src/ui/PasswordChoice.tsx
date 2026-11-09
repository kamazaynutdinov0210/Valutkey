import { useState } from 'react'
import { generate } from '../generator'
import { DEFAULT_PASSPHRASE_SETTINGS } from '../generator/passphrase'
import { Button, Field, StrengthMeter, Toggle } from './components'
import { useStrength } from './hooks'

export const MIN_MASTER_LENGTH = 12

/** State for "pick a new master password": used by setup and by recovery. */
export function usePasswordChoice() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const strength = useStrength(password)
  const longEnough = password.length >= MIN_MASTER_LENGTH
  const strongEnough = (strength?.level ?? 0) >= 2
  const matches = password !== '' && password === confirm
  return {
    password,
    setPassword,
    confirm,
    setConfirm,
    show,
    setShow,
    strength,
    longEnough,
    strongEnough,
    matches,
    valid: longEnough && strongEnough && matches,
    reset: () => {
      setPassword('')
      setConfirm('')
    },
  }
}

export function PasswordChoice({ choice, label = 'Master password' }: { choice: ReturnType<typeof usePasswordChoice>; label?: string }) {
  const suggest = () => {
    const words = generate({ ...DEFAULT_PASSPHRASE_SETTINGS, words: 7, separator: ' ' }).value
    choice.setPassword(words)
    choice.setConfirm(words)
    choice.setShow(true)
  }
  const problem = !choice.password
    ? undefined
    : !choice.longEnough
      ? `Use at least ${MIN_MASTER_LENGTH} characters.`
      : choice.strength && !choice.strongEnough
        ? 'That is too easy to guess. Try a longer phrase, or use the suggestion.'
        : undefined
  const type = choice.show ? 'text' : 'password'
  const textProps = { autoComplete: 'off', autoCapitalize: 'off', autoCorrect: 'off', spellCheck: false } as const

  return (
    <div className="flex flex-col gap-4">
      <Field
        label={label}
        hint="A few random words is easiest to remember and hard to guess."
        type={type}
        value={choice.password}
        onChange={(e) => choice.setPassword(e.target.value)}
        error={problem}
        {...textProps}
      />
      <StrengthMeter strength={choice.strength} />
      <Field
        label="Type it again"
        type={type}
        value={choice.confirm}
        onChange={(e) => choice.setConfirm(e.target.value)}
        error={choice.confirm && !choice.matches ? 'The two entries don’t match.' : undefined}
        {...textProps}
      />
      <Toggle label="Show what I type" checked={choice.show} onChange={(e) => choice.setShow(e.target.checked)} />
      <Button variant="secondary" onClick={suggest}>
        Suggest a passphrase
      </Button>
    </div>
  )
}
