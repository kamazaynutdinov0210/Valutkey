import { describe, expect, it } from 'vitest'
import { createIdleLock } from '../../src/vault/idleLock'

/** A fake clock: timers fire only when the test advances time. */
function fakeClock() {
  let time = 0
  let nextId = 1
  const timers = new Map<number, { at: number; fn: () => void }>()
  return {
    now: () => time,
    setTimer: (fn: () => void, ms: number) => {
      const id = nextId++
      timers.set(id, { at: time + ms, fn })
      return id
    },
    clearTimer: (id: unknown) => void timers.delete(id as number),
    advance(ms: number) {
      const target = time + ms
      for (;;) {
        const due = [...timers.entries()].filter(([, t]) => t.at <= target).sort((a, b) => a[1].at - b[1].at)[0]
        if (!due) break
        time = due[1].at
        timers.delete(due[0])
        due[1].fn()
      }
      time = target
    },
    jump: (ms: number) => void (time += ms), // time passes but no timers run (frozen page)
  }
}

describe('idle lock', () => {
  it('locks after the timeout with no activity', () => {
    const clock = fakeClock()
    let locks = 0
    createIdleLock({ timeoutMs: 1000, onLock: () => locks++, ...clock })
    clock.advance(999)
    expect(locks).toBe(0)
    clock.advance(1)
    expect(locks).toBe(1)
  })

  it('activity pushes the deadline back', () => {
    const clock = fakeClock()
    let locks = 0
    const lock = createIdleLock({ timeoutMs: 1000, onLock: () => locks++, ...clock })
    clock.advance(600)
    lock.poke()
    clock.advance(600)
    expect(locks).toBe(0)
    clock.advance(400)
    expect(locks).toBe(1)
  })

  it('locks only once', () => {
    const clock = fakeClock()
    let locks = 0
    const lock = createIdleLock({ timeoutMs: 1000, onLock: () => locks++, ...clock })
    clock.advance(5000)
    lock.check()
    expect(locks).toBe(1)
  })

  it('locks on return if the page was frozen and the timer never ran', () => {
    const clock = fakeClock()
    let locks = 0
    const lock = createIdleLock({ timeoutMs: 1000, onLock: () => locks++, ...clock })
    clock.jump(5000)
    expect(locks).toBe(0)
    lock.check()
    expect(locks).toBe(1)
  })

  it('does not lock early when checked during activity', () => {
    const clock = fakeClock()
    let locks = 0
    const lock = createIdleLock({ timeoutMs: 1000, onLock: () => locks++, ...clock })
    clock.advance(500)
    lock.check()
    expect(locks).toBe(0)
  })

  it('applies a new timeout from now, and stop() prevents locking', () => {
    const clock = fakeClock()
    let locks = 0
    const lock = createIdleLock({ timeoutMs: 1000, onLock: () => locks++, ...clock })
    clock.advance(900)
    lock.setTimeoutMs(5000)
    clock.advance(4000)
    expect(locks).toBe(0)
    clock.advance(1000)
    expect(locks).toBe(1)

    const second = fakeClock()
    let more = 0
    const stopped = createIdleLock({ timeoutMs: 1000, onLock: () => more++, ...second })
    stopped.stop()
    second.advance(10_000)
    stopped.check()
    expect(more).toBe(0)
  })
})
