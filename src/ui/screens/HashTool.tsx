import { useState } from 'react'
import { argon2Worker } from '../../crypto/argon2Client'
import { HASH_ALGORITHMS, HASH_TOOL_NOTICE, hashText, HashToolError, type HashAlgorithm } from '../../tools/hashTool'
import { secretClipboard } from '../clipboard'
import { Button, Card, Field } from '../components'

export function HashTool() {
  const [algorithm, setAlgorithm] = useState<HashAlgorithm>('sha256')
  const [text, setText] = useState('')
  const [result, setResult] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const note = HASH_ALGORITHMS.find((a) => a.id === algorithm)?.note

  const run = async () => {
    setBusy(true); setMessage(''); setResult('')
    try { setResult(await hashText(text, algorithm, argon2Worker)) }
    catch (e) { setMessage(e instanceof HashToolError ? e.message : 'That didn’t work. Please try again.') }
    finally { setBusy(false) }
  }
  const copy = async () => {
    try { await secretClipboard().copy(result); setMessage('Copied.') }
    catch { setMessage('Couldn’t copy. Select the text and copy it yourself.') }
  }

  return (
    <details className="group rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <summary className="min-h-11 cursor-pointer list-none px-4 py-3 text-lg font-semibold marker:content-none">Hash some text <span className="text-sm font-normal text-slate-600 dark:text-slate-300">(advanced)</span></summary>
      <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-4 dark:border-slate-700">
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-100">{HASH_TOOL_NOTICE}</p>
        <label className="flex flex-col gap-1">
          <span className="font-medium">Method</span>
          <select className="min-h-11 rounded-xl border border-slate-400 bg-white px-3 text-base text-slate-900 shadow-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100" value={algorithm}
            onChange={(e) => { setAlgorithm(e.target.value as HashAlgorithm); setResult(''); setMessage('') }}>
            {HASH_ALGORITHMS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
        </label>
        <p className="text-sm text-slate-700 dark:text-slate-300">{note}</p>
        <Field label="Text to hash" type="password" value={text} onChange={(e) => { setText(e.target.value); setResult('') }} autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false} />
        <Button onClick={() => void run()} disabled={busy} className="self-start">{busy ? 'Working…' : 'Hash it'}</Button>
        {result && (
          <Card className="gap-2 bg-slate-50 dark:bg-slate-800/40">
            <p data-testid="hash-result" className="break-all font-mono text-sm">{result}</p>
            <Button variant="secondary" onClick={() => void copy()} className="self-start">Copy result</Button>
          </Card>
        )}
        <p role="status" aria-live="polite" className="min-h-5 text-sm">{message}</p>
      </div>
    </details>
  )
}
