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
  const { settings, secret } = state

  const apply = (next: GeneratorSettings) => { setState({ settings: next, secret: generate(next).value }); setNote('') }
  const copy = async () => {
    try { await secretClipboard().copy(secret); setNote('Copied. It will be cleared from your clipboard in 30 seconds.') }
    catch { setNote('Couldn’t copy. Select the text and copy it yourself.') }
  }

  return (
    <Screen title="Generator">
      <Card className="gap-4">
        <ModeSwitch settings={settings} onChange={apply} />
        <p data-testid="generated" className="break-all rounded-2xl border border-slate-200 bg-slate-50 p-4 font-mono text-xl leading-relaxed dark:border-slate-700 dark:bg-slate-800/70">{secret}</p>
        <StrengthMeter strength={rateGenerated(settings)} />
        <div className="flex flex-wrap gap-2">
          <Button className="flex-1" onClick={() => apply(settings)}>Generate</Button>
          <Button variant="secondary" className="flex-1" onClick={() => void copy()}>Copy</Button>
        </div>
        <p role="status" aria-live="polite" className="min-h-6 text-sm">{note}</p>
      </Card>
      <Card title="Options"><GeneratorOptions settings={settings} onChange={apply} /></Card>
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
    <details className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <summary className="min-h-11 cursor-pointer py-1 text-lg font-semibold">Check a password you already use</summary>
      <div className="flex flex-col gap-3 pt-3">
        <Field label="Your password" hint="It is checked on this device only and never saved." type={show ? 'text' : 'password'} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false} />
        <Toggle label="Show what I type" checked={show} onChange={(e) => setShow(e.target.checked)} />
        <StrengthMeter strength={strength} />
      </div>
    </details>
  )
}
