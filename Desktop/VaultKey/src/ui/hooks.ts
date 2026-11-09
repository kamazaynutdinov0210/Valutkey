import { useEffect, useState, useSyncExternalStore } from 'react'
import { ratePassword, type Strength } from '../generator'
import { installKind, installStore, isStandalone, type InstallKind } from '../pwa/install'
import type { Store } from '../pwa/store'
import { session } from '../vault/instance'

export const useSessionState = () => useSyncExternalStore(session.subscribe, session.getState)

/** Rates a typed password a moment after typing stops. The password itself is never stored here. */
/** `hintKey` joins things an attacker would try first (title, username) with "|". */
export function useStrength(password: string, hintKey = ''): Strength | null {
  const [strength, setStrength] = useState<Strength | null>(null)
  useEffect(() => {
    if (password === '') {
      setStrength(null)
      return
    }
    let cancelled = false
    const timer = setTimeout(() => {
      void ratePassword(password, hintKey ? hintKey.split('|') : []).then((result) => {
        if (!cancelled) setStrength(result)
      })
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [password, hintKey])
  return strength
}

export const useStore = <T,>(store: Store<T>): T => useSyncExternalStore(store.subscribe, store.get)

export function useInstallKind(): InstallKind {
  const { hasPrompt } = useStore(installStore)
  return installKind({ standalone: isStandalone(), hasPrompt, userAgent: navigator.userAgent, maxTouchPoints: navigator.maxTouchPoints })
}
