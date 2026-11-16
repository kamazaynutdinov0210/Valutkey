import { describe, expect, it } from 'vitest'
import { appendEvent } from '../../src/security/activity'

describe('security activity', () => {
  it('keeps metadata only and enforces retention', () => {
    let events: ReturnType<typeof appendEvent> = []
    for (let i = 0; i < 205; i++) events = appendEvent(events, 'unlock-success', i)
    expect(events.length).toBe(200)
    expect(events[0]?.type).toBe('unlock-success')
  })
})
