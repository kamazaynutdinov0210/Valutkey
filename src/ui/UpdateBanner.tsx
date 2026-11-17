import { applyUpdate, updateStore } from '../pwa/updates'
import { Button } from './components'
import { useStore } from './hooks'

/** Shown when a new version is waiting. Applying it reloads the app, which locks the vault. */
export function UpdateBanner() {
  const { updateReady } = useStore(updateStore)
  if (!updateReady) return null
  return (
    <div role="status" className="flex flex-wrap items-center gap-3 border-b border-emerald-900 bg-emerald-50 px-4 py-3 text-emerald-950 dark:border-emerald-300 dark:bg-slate-800 dark:text-emerald-100">
      <p className="flex-1 font-medium">A new version of VaultKey is ready. Restarting locks your vault.</p>
      <Button onClick={applyUpdate}>Restart to update</Button>
    </div>
  )
}
