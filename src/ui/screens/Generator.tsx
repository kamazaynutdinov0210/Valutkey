import { useState } from 'react'
import { defaultSettings, generate, rateGenerated, type GeneratorSettings } from '../../generator'
import { Button, Card, Field, Screen, StrengthMeter, Toggle } from '../components'
import { secretClipboard } from '../clipboard'
import { GeneratorOptions, ModeSwitch } from '../GeneratorOptions'
import { useStrength } from '../hooks'
import { HashTool } from './HashTool'

export function Generator() {
  const [state, setState] = useState(() => {
    const settings = defaultSettings('password')
    return { settings, secret: generate(settings).value }
  })
  const [note, setNote] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [showHistory, setShowHistory] = useState<Record<number, boolean>>({})
  const { settings, secret } = state

  const apply = (next: GeneratorSettings) => {
    setHistory((prev) => [state.secret, ...prev].slice(0, 5))
    setState({ settings: next, secret: generate(next).value })
    setNote('')
  }
  const copy = async () => {
    try { await secretClipboard().copy(secret); setNote('Copied. It will be cleared from your clipboard in 30 seconds.') }
    catch { setNote('Couldn’t copy. Select the text and copy it yourself.') }
  }

  return (
    <Screen title="Generator">
      <Card className="gap-4">
        <ModeSwitch settings={settings} onChange={apply} />
        <p data-testid="generated" className="break-all rounded-2xl border border-[rgb(var(--vk-border))] bg-[rgb(var(--vk-surface-2))] p-4 font-mono text-xl leading-relaxed">{secret}</p>
        <StrengthMeter strength={rateGenerated(settings)} />
        <div className="flex flex-wrap gap-2">
          <Button className="flex-1" onClick={() => apply(settings)}>Generate</Button>
          <Button variant="secondary" className="flex-1" onClick={() => void copy()}>Copy</Button>
        </div>
        <p role="status" aria-live="polite" className="min-h-6 text-sm">{note}</p>
      </Card>
      <Card title="Options"><GeneratorOptions settings={settings} onChange={apply} /></Card>
      {history.length > 0 && (
        <Card title="Recently generated (this session)">
          <p className="text-sm text-[rgb(var(--vk-text-muted))]">Kept in memory only. It is cleared when you lock or close VaultKey.</p>
          <ul className="flex flex-col gap-2">
            {history.map((value, i) => (
              <li key={`${value}-${i}`} className="flex flex-wrap items-center gap-2 rounded-xl border border-[rgb(var(--vk-border))] bg-[rgb(var(--vk-surface-2))] p-3">
                <span className="min-w-0 flex-1 break-all font-mono">{showHistory[i] ? value : '••••••••••'}</span>
                <Button variant="secondary" onClick={() => setShowHistory((s) => ({ ...s, [i]: !s[i] }))}>{showHistory[i] ? 'Hide' : 'Reveal'}</Button>
                <Button variant="secondary" aria-label="Save to clipboard" onClick={() => void secretClipboard().copy(value).then(() => setNote('Copied. It will be cleared from your clipboard in 30 seconds.')).catch(() => setNote('Couldn’t copy. Select the text and copy it yourself.'))}>Save</Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <CheckOwn />
      <HashTool />
    </Screen>
  )
}

function CheckOwn() {
  const [typed, setTyped] = useState('')
  const [show, setShow] = useState(false)
  const strength = useStrength(typed)
  return (
    <details className="rounded-2xl border border-[rgb(var(--vk-border))] bg-[rgb(var(--vk-surface))] p-4 shadow-sm">
      <summary className="min-h-11 cursor-pointer py-1 text-lg font-semibold">Check a password you already use</summary>
      <div className="flex flex-col gap-3 pt-3">
        <Field label="Your password" hint="It is checked on this device only and never saved." type={show ? 'text' : 'password'} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false} />
        <Toggle label="Show what I type" checked={show} onChange={(e) => setShow(e.target.checked)} />
        <StrengthMeter strength={strength} />
      </div>
    </details>
  )
}
