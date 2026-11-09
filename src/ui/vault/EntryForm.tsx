import { useState, type FormEvent } from 'react'
import { defaultSettings, generate, type GeneratorSettings } from '../../generator'
import { EntryError, parseTagText, ROTATION_MAX, type Entry, type RotationUnit } from '../../vault/entry'
import { Button, Field, Screen, StrengthMeter, TextArea, Toggle } from '../components'
import { GeneratorOptions, ModeSwitch } from '../GeneratorOptions'
import { useStrength } from '../hooks'
import type { VaultApi } from '../useVault'

interface Props {
  vault: VaultApi
  entry?: Entry // present when editing
  onCancel: () => void
  onSaved: (entry: Entry) => void
}

const PRIVATE = { autoComplete: 'off', autoCapitalize: 'off', autoCorrect: 'off', spellCheck: false } as const

export function EntryForm({ vault, entry, onCancel, onSaved }: Props) {
  const [title, setTitle] = useState(entry?.title ?? '')
  const [username, setUsername] = useState(entry?.username ?? '')
  const [url, setUrl] = useState(entry?.url ?? '')
  const [password, setPassword] = useState(entry?.password ?? '')
  const [notes, setNotes] = useState(entry?.notes ?? '')
  const [tagText, setTagText] = useState(entry?.tags.join(', ') ?? '')
  const [generator, setGenerator] = useState<GeneratorSettings>(entry?.generator ?? defaultSettings('password'))
  const [remind, setRemind] = useState(Boolean(entry?.rotation))
  const [every, setEvery] = useState(String(entry?.rotation?.every ?? 3))
  const [unit, setUnit] = useState<RotationUnit>(entry?.rotation?.unit ?? 'month')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const strength = useStrength(password, [title, username].filter(Boolean).join('|'))

  const fill = () => {
    setPassword(generate(generator).value)
    setShowPassword(true)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const rotation = remind ? { every: Number(every), unit } : undefined
      const input = { title, username, url, password, notes, tags: parseTagText(tagText), generator, rotation }
      onSaved(entry ? await vault.update(entry.id, input) : await vault.create(input))
    } catch (e) {
      setError(e instanceof EntryError ? e.message : 'Couldn’t save. Please try again.')
      setBusy(false)
    }
  }

  return (
    <Screen title={entry ? 'Edit password' : 'Add a password'}>
      <form onSubmit={submit} className="flex flex-col gap-5">
        <Field label="Title" hint="For example: Bank, or Work email." value={title} onChange={(e) => setTitle(e.target.value)} autoComplete="off" required />
        <Field label="Username or email" value={username} onChange={(e) => setUsername(e.target.value)} {...PRIVATE} />
        <Field label="Website" hint="Optional." value={url} onChange={(e) => setUrl(e.target.value)} {...PRIVATE} />

        <div className="flex flex-col gap-3">
          <Field label="Password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} {...PRIVATE} />
          <div className="flex gap-2">
            <Button className="flex-1" onClick={fill}>
              Generate
            </Button>
            <Button variant="secondary" className="flex-1" aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>
              {showPassword ? 'Hide' : 'Show'}
            </Button>
          </div>
          <StrengthMeter strength={strength} />
          <details className="rounded-xl border border-slate-400 p-4 dark:border-slate-600">
            <summary className="min-h-11 cursor-pointer py-2 font-semibold">Password style</summary>
            <div className="flex flex-col gap-3 pt-2">
              <p className="text-sm">These choices are saved with this entry and used the next time a new password is made for it.</p>
              <ModeSwitch settings={generator} onChange={setGenerator} />
              <GeneratorOptions settings={generator} onChange={setGenerator} />
            </div>
          </details>
        </div>

        <fieldset className="flex flex-col gap-2 rounded-xl border border-slate-400 p-4 dark:border-slate-600">
          <legend className="px-1 font-semibold">Reminder</legend>
          <Toggle label="Remind me to change this password" checked={remind} onChange={(e) => setRemind(e.target.checked)} />
          {remind && (
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Field label="Every" type="number" inputMode="numeric" min={1} max={ROTATION_MAX[unit]} value={every} onChange={(e) => setEvery(e.target.value)} />
              </div>
              <label className="flex flex-1 flex-col gap-1">
                <span className="font-medium">Unit</span>
                <select
                  className="min-h-11 rounded-xl border border-slate-500 bg-white px-3 text-base text-slate-900 dark:bg-slate-800 dark:text-slate-100"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value as RotationUnit)}
                >
                  <option value="day">days</option>
                  <option value="week">weeks</option>
                  <option value="month">months</option>
                </select>
              </label>
            </div>
          )}
        </fieldset>

        <TextArea label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} {...PRIVATE} />
        <Field label="Tags" hint="Separate with commas, like: work, banking." value={tagText} onChange={(e) => setTagText(e.target.value)} autoComplete="off" />

        {error && (
          <p role="alert" className="font-medium text-red-800 dark:text-red-300">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <Button type="submit" disabled={busy} className="flex-1">
            Save
          </Button>
          <Button variant="secondary" disabled={busy} onClick={onCancel} className="flex-1">
            Cancel
          </Button>
        </div>
      </form>
    </Screen>
  )
}
