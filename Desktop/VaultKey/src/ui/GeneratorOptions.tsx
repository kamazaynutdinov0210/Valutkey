import { defaultSettings, type GeneratorSettings } from '../generator'
import { Button, Toggle } from './components'

const SELECT_STYLE =
  'min-h-11 rounded-xl border border-slate-500 bg-white px-3 text-base text-slate-900 dark:bg-slate-800 dark:text-slate-100'
const SEPARATORS = [
  { value: '-', label: 'Dash ( - )' },
  { value: ' ', label: 'Space' },
  { value: '.', label: 'Dot ( . )' },
  { value: '', label: 'None' },
]

type PasswordSettings = Extract<GeneratorSettings, { mode: 'password' }>
type PassphraseSettings = Extract<GeneratorSettings, { mode: 'passphrase' }>
interface Props<S> {
  settings: S
  onChange: (s: GeneratorSettings) => void
}

export function ModeSwitch({ settings, onChange }: Props<GeneratorSettings>) {
  return (
    <div className="flex gap-2" role="group" aria-label="Type of secret">
      {(['password', 'passphrase'] as const).map((mode) => (
        <Button
          key={mode}
          variant={settings.mode === mode ? 'primary' : 'secondary'}
          aria-pressed={settings.mode === mode}
          onClick={() => settings.mode !== mode && onChange(defaultSettings(mode))}
          className="flex-1"
        >
          {mode === 'password' ? 'Password' : 'Passphrase'}
        </Button>
      ))}
    </div>
  )
}

export function GeneratorOptions({ settings, onChange }: Props<GeneratorSettings>) {
  return settings.mode === 'password' ? <PasswordOptions settings={settings} onChange={onChange} /> : <PassphraseOptions settings={settings} onChange={onChange} />
}

function PasswordOptions({ settings, onChange }: Props<PasswordSettings>) {
  const kinds = [
    { key: 'lower', label: 'Lowercase letters (a-z)' },
    { key: 'upper', label: 'Uppercase letters (A-Z)' },
    { key: 'digits', label: 'Numbers (0-9)' },
    { key: 'symbols', label: 'Symbols (!@#…)' },
  ] as const
  const on = kinds.filter((k) => settings[k.key]).length
  return (
    <div className="flex flex-col gap-1">
      <label className="flex flex-col gap-1 pb-2">
        <span className="font-medium">Length: {settings.length}</span>
        <input
          type="range"
          min={8}
          max={128}
          value={settings.length}
          onChange={(e) => onChange({ ...settings, length: Number(e.target.value) })}
          className="h-11 w-full accent-blue-800 dark:accent-blue-300"
        />
      </label>
      {kinds.map((k) => (
        <Toggle
          key={k.key}
          label={k.label}
          checked={settings[k.key]}
          disabled={settings[k.key] && on === 1}
          onChange={(e) => onChange({ ...settings, [k.key]: e.target.checked })}
        />
      ))}
      <Toggle
        label="Avoid look-alike characters (0 O o 1 l I)"
        checked={settings.excludeLookalikes}
        onChange={(e) => onChange({ ...settings, excludeLookalikes: e.target.checked })}
      />
    </div>
  )
}

function PassphraseOptions({ settings, onChange }: Props<PassphraseSettings>) {
  return (
    <div className="flex flex-col gap-1">
      <label className="flex flex-col gap-1 pb-2">
        <span className="font-medium">Words: {settings.words}</span>
        <input
          type="range"
          min={3}
          max={12}
          value={settings.words}
          onChange={(e) => onChange({ ...settings, words: Number(e.target.value) })}
          className="h-11 w-full accent-blue-800 dark:accent-blue-300"
        />
      </label>
      <label className="flex flex-col gap-1 pb-2">
        <span className="font-medium">Between words</span>
        <select className={SELECT_STYLE} value={settings.separator} onChange={(e) => onChange({ ...settings, separator: e.target.value })}>
          {SEPARATORS.map((s) => (
            <option key={s.label} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      <Toggle label="Capitalize each word" checked={settings.capitalize} onChange={(e) => onChange({ ...settings, capitalize: e.target.checked })} />
      <Toggle label="Add a number" checked={settings.includeNumber} onChange={(e) => onChange({ ...settings, includeNumber: e.target.checked })} />
    </div>
  )
}
