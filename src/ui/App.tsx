import { useEffect, useState } from 'react'
import { session } from '../vault/instance'
import { useSessionState } from './hooks'
import { Setup } from './screens/Setup'
import { UpdateBanner } from './UpdateBanner'
import { Shell } from './shell/Shell'
import { Unlock } from './screens/Unlock'

export function App() {
  const state = useSessionState()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    session.init().catch(() => setFailed(true))
  }, [])

  if (failed) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-xl flex-col gap-4 px-5 py-10">
        <h1 className="text-3xl font-bold">VaultKey can’t save data here</h1>
        <p>
          Your browser is blocking local storage, which is often the case in private or incognito windows. Open VaultKey
          in a normal window and try again.
        </p>
      </main>
    )
  }

  return (
    <>
      <UpdateBanner />
      <Screens status={state.status} />
    </>
  )
}

function Screens({ status }: { status: ReturnType<typeof useSessionState>['status'] }) {
  switch (status) {
    case 'loading':
      return (
        <main aria-busy="true" className="grid min-h-dvh place-items-center">
          <p>Loading…</p>
        </main>
      )
    case 'no-vault':
      return <Setup />
    case 'locked':
      return <Unlock />
    case 'unlocked':
      return <Shell />
  }
}
