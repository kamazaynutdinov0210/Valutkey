export interface IdleLockOptions {
  timeoutMs: number
  onLock: () => void
  now?: () => number
  setTimer?: (fn: () => void, ms: number) => unknown
  clearTimer?: (id: unknown) => void
}

/**
 * Locks after `timeoutMs` without activity. `poke()` only records the time (cheap, safe to call
 * on every tap); one timer checks it. `check()` covers phones that freeze the page in the
 * background: timers may not fire, so we also compare clocks when the app comes back.
 */
export function createIdleLock(options: IdleLockOptions) {
  const now = options.now ?? Date.now
  const setTimer = options.setTimer ?? ((fn, ms) => setTimeout(fn, ms))
  const clearTimer = options.clearTimer ?? ((id) => clearTimeout(id as ReturnType<typeof setTimeout>))
  let timeoutMs = options.timeoutMs
  let last = now()
  let timer: unknown
  let done = false

  const lock = () => {
    if (done) return
    done = true
    clearTimer(timer)
    options.onLock()
  }
  const tick = () => {
    const idle = now() - last
    if (idle >= timeoutMs) lock()
    else timer = setTimer(tick, timeoutMs - idle)
  }
  timer = setTimer(tick, timeoutMs)

  return {
    poke(): void {
      last = now()
    },
    check(): void {
      if (!done && now() - last >= timeoutMs) lock()
    },
    setTimeoutMs(ms: number): void {
      timeoutMs = ms
      last = now()
      clearTimer(timer)
      if (!done) timer = setTimer(tick, timeoutMs)
    },
    stop(): void {
      done = true
      clearTimer(timer)
    },
  }
}
