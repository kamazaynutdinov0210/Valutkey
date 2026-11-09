import { describe, expect, it } from 'vitest'
import { CLIPBOARD_CLEAR_MS, createClipboardCleaner } from '../../src/ui/clipboard'

function setup(failWrites = false) {
  const writes: string[] = []
  const timers = new Map<number, { ms: number; fn: () => void }>()
  let id = 0
  const cleaner = createClipboardCleaner({
    clipboard: {
      writeText: async (t) => {
        if (failWrites && t === '') throw new Error('not focused')
        writes.push(t)
      },
    },
    setTimer: (fn, ms) => {
      timers.set(++id, { ms, fn })
      return id
    },
    clearTimer: (i) => void timers.delete(i as number),
  })
  const fire = async () => {
    for (const [key, t] of [...timers]) {
      timers.delete(key)
      t.fn()
    }
    await Promise.resolve()
    await Promise.resolve()
  }
  return { cleaner, writes, timers, fire }
}

describe('clipboard auto-clear', () => {
  it('waits 30 seconds by default', () => {
    expect(CLIPBOARD_CLEAR_MS).toBe(30_000)
  })

  it('copies, then overwrites with an empty string when the timer fires', async () => {
    const { cleaner, writes, timers, fire } = setup()
    await cleaner.copy('s3cret')
    expect(writes).toEqual(['s3cret'])
    expect([...timers.values()][0]?.ms).toBe(30_000)
    expect(cleaner.isPending()).toBe(true)
    await fire()
    expect(writes).toEqual(['s3cret', ''])
    expect(cleaner.isPending()).toBe(false)
  })

  it('a second copy restarts the timer instead of stacking timers', async () => {
    const { cleaner, writes, timers, fire } = setup()
    await cleaner.copy('one')
    await cleaner.copy('two')
    expect(timers.size).toBe(1)
    await fire()
    expect(writes).toEqual(['one', 'two', ''])
  })

  it('clearNow wipes immediately (used when the vault locks) and does nothing if nothing is pending', async () => {
    const { cleaner, writes, timers } = setup()
    await cleaner.clearNow()
    expect(writes).toEqual([])
    await cleaner.copy('x')
    await cleaner.clearNow()
    expect(writes).toEqual(['x', ''])
    expect(timers.size).toBe(0)
  })

  it('does not crash if the browser refuses the clear', async () => {
    const { cleaner, fire } = setup(true)
    await cleaner.copy('x')
    await fire()
    expect(cleaner.isPending()).toBe(false)
  })
})
