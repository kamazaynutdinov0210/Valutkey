import { useState } from 'react'
import { argon2Worker } from '../../crypto/argon2Client'
import { HASH_ALGORITHMS, HASH_TOOL_NOTICE, hashText, HashToolError, type HashAlgorithm } from '../../tools/hashTool'
import { secretClipboard } from '../clipboard'
import { Button, Field } from '../components'

export function HashTool() {
  const [algorithm, setAlgorithm] = useState<HashAlgorithm>('sha256')
  const [text, setText] = useState('')
  const [result, setResult] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const note = HASH_ALGORITHMS.find((a) => a.id === algorithm)?.note

  const run = async () => {
    setBusy(true)
    setMessage('')
    setResult('')
    try {
      setResult(await hashText(text, algorithm, argon2Worker))
    } catch (e) {
      setMessage(e instanceof HashToolError ? e.message : 'That didn’t work. Please try again.')
    } finally {
      setBusy(false)
    }
  }
  const copy = async () => {
    try {
      await secretClipboard().copy(result)
      setMessage('Copied.')
    } catch {
      setMessage('Couldn’t copy. Select the text and copy it yourself.')
    }
  }

  return (
    <details className="rounded-xl border border-slate-400 p-4 dark:border-slate-600">
      <summary className="min-h-11 cursor-pointer py-2 font-semibold">Hash some text (advanced)</summary>
      <div className="flex flex-col gap-3 pt-2">
        <p className="rounded-xl bg-slate-100 p-3 text-sm dark:bg-slate-800">{HASH_TOOL_NOTICE}</p>
        <label className="flex flex-col gap-1">
          <span className="font-medium">Method</span>
          <select
            className="min-h-11 rounded-xl border border-slate-500 bg-white px-3 text-base text-slate-900 dark:bg-slate-800 dark:text-slate-100"
            value={algorithm}
            onChange={(e) => {
              setAlgorithm(e.target.value as HashAlgorithm)
              setResult('')
              setMessage('')
            }}
          >
            {HASH_ALGORITHMS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
        <p className="text-sm">{note}</p>
        <Field
          label="Text to hash"
          type="password"
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setResult('')
          }}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        <Button onClick={() => void run()} disabled={busy}>
          {busy ? 'Working…' : 'Hash it'}
        </Button>
        {result && (
          <>
            <p data-testid="hash-result" className="break-all rounded-xl border border-slate-500 p-3 font-mono text-sm">
              {result}
            </p>
            <Button variant="secondary" onClick={() => void copy()}>
              Copy result
            </Button>
          </>
        )}
        <p role="status" className="text-sm">
          {message}
        </p>
      </div>
    </details>
  )
}
