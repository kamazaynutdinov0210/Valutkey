import { useState } from 'react'
import { defaultSettings, generate, rateGenerated, type GeneratorSettings } from '../../generator'
import { Button, Field, Screen, StrengthMeter, Toggle } from '../components'
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

  const apply = (next: GeneratorSettings) => {
    setState({ settings: next, secret: generate(next).value })
    setNote('')
  }
  const copy = async () => {
    try {
      await secretClipboard().copy(secret)
      setNote('Copied. It will be cleared from your clipboard in 30 seconds.')
    } catch {
      setNote('Couldn’t copy. Select the text and copy it yourself.')
    }
  }

  return (
    <Screen title="Generator">
      <ModeSwitch settings={settings} onChange={apply} />

      <p data-testid="generated" className="break-all rounded-xl border border-slate-500 bg-slate-100 p-4 font-mono text-xl leading-relaxed dark:bg-slate-800">
        {secret}
      </p>
      <StrengthMeter strength={rateGenerated(settings)} />

      <div className="flex gap-2">
        <Button className="flex-1" onClick={() => apply(settings)}>
          Generate
        </Button>
        <Button variant="secondary" className="flex-1" onClick={() => void copy()}>
          Copy
        </Button>
      </div>
      <p role="status" className="min-h-6 text-sm">
        {note}
      </p>

      <GeneratorOptions settings={settings} onChange={apply} />

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
    <details className="rounded-xl border border-slate-400 p-4 dark:border-slate-600">
      <summary className="min-h-11 cursor-pointer py-2 font-semibold">Check a password you already use</summary>
      <div className="flex flex-col gap-3 pt-2">
        <Field
          label="Your password"
          hint="It is checked on this device only and never saved."
          type={show ? 'text' : 'password'}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        <Toggle label="Show what I type" checked={show} onChange={(e) => setShow(e.target.checked)} />
        <StrengthMeter strength={strength} />
      </div>
    </details>
  )
}
