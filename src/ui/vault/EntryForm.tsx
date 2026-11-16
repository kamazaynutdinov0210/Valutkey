import { useState, type FormEvent } from 'react'
import { defaultSettings, generate, type GeneratorSettings } from '../../generator'
import { EntryError, parseTagText, ROTATION_MAX, type Entry, type RotationUnit } from '../../vault/entry'
import { Button, Card, Field, Screen, StrengthMeter, TextArea, Toggle } from '../components'
import { GeneratorOptions, ModeSwitch } from '../GeneratorOptions'
import { useStrength } from '../hooks'
import type { VaultApi } from '../useVault'

interface Props {
  vault: VaultApi
  entry?: Entry
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
  const [category, setCategory] = useState(entry?.category ?? '')
  const [tagText, setTagText] = useState(entry?.tags.join(', ') ?? '')
  const [generator, setGenerator] = useState<GeneratorSettings>(entry?.generator ?? defaultSettings('password'))
  const [remind, setRemind] = useState(Boolean(entry?.rotation))
  const [every, setEvery] = useState(String(entry?.rotation?.every ?? 3))
  const [unit, setUnit] = useState<RotationUnit>(entry?.rotation?.unit ?? 'month')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const strength = useStrength(password, [title, username].filter(Boolean).join('|'))

  const fill = () => { setPassword(generate(generator).value); setShowPassword(true) }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    setBusy(true); setError('')
    try {
      const rotation = remind ? { every: Number(every), unit } : undefined
      const input = { title, username, url, password, notes, tags: parseTagText(tagText), generator, rotation, category: category.trim() || undefined, favorite: entry?.favorite }
      onSaved(entry ? await vault.update(entry.id, input) : await vault.create(input))
    } catch (e) {
      setError(e instanceof EntryError ? e.message : 'Couldn’t save. Please try again.')
      setBusy(false)
    }
  }

  return (
    <Screen title={entry ? 'Edit password' : 'Add a password'}>
      <form onSubmit={submit} className="flex flex-col gap-5">
        <Card className="gap-4">
          <Field label="Title" hint="For example: Bank, or Work email." value={title} onChange={(e) => setTitle(e.target.value)} autoComplete="off" required autoFocus />
          <Field label="Username or email" value={username} onChange={(e) => setUsername(e.target.value)} {...PRIVATE} />
          <Field label="Website" hint="Optional." value={url} onChange={(e) => setUrl(e.target.value)} inputMode="url" {...PRIVATE} />
        </Card>

        <Card title="Password" className="gap-3">
          <Field label="Password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} {...PRIVATE} />
          <div className="flex flex-wrap gap-2">
            <Button className="flex-1" onClick={fill}>Generate</Button>
            <Button variant="secondary" className="flex-1" aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? 'Hide' : 'Show'}</Button>
          </div>
          <StrengthMeter strength={strength} />
          <details className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/40">
            <summary className="min-h-11 cursor-pointer py-1 font-semibold">Password style</summary>
            <div className="flex flex-col gap-3 pt-2">
              <p className="text-sm text-slate-700 dark:text-slate-300">These choices are saved with this entry and used the next time a new password is made for it.</p>
              <ModeSwitch settings={generator} onChange={setGenerator} />
              <GeneratorOptions settings={generator} onChange={setGenerator} />
            </div>
          </details>
        </Card>

        <Card>
          <fieldset className="flex flex-col gap-3">
            <legend className="text-lg font-semibold">Reminder</legend>
            <Toggle label="Remind me to change this password" checked={remind} onChange={(e) => setRemind(e.target.checked)} />
            {remind && (
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-28 flex-1"><Field label="Every" type="number" inputMode="numeric" min={1} max={ROTATION_MAX[unit]} value={every} onChange={(e) => setEvery(e.target.value)} /></div>
                <label className="min-w-32 flex-1 flex flex-col gap-1"><span className="font-medium">Unit</span>
                  <select className="min-h-11 rounded-xl border border-slate-400 bg-white px-3 text-base text-slate-900 shadow-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100" value={unit} onChange={(e) => setUnit(e.target.value as RotationUnit)}>
                    <option value="day">days</option><option value="week">weeks</option><option value="month">months</option>
                  </select>
                </label>
              </div>
            )}
          </fieldset>
        </Card>

        <Card className="gap-4">
          <TextArea label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} {...PRIVATE} />
          <Field label="Category" hint="Optional, like Banking or Work." value={category} onChange={(e) => setCategory(e.target.value)} autoComplete="off" />
          <Field label="Tags" hint="Separate with commas, like: work, banking." value={tagText} onChange={(e) => setTagText(e.target.value)} autoComplete="off" />
        </Card>

        {error && <p role="alert" className="font-medium text-red-800 dark:text-red-300">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={busy} className="flex-1">{busy ? 'Saving…' : 'Save'}</Button>
          <Button variant="secondary" disabled={busy} onClick={onCancel} className="flex-1">Cancel</Button>
        </div>
      </form>
    </Screen>
  )
}
