import { useState } from 'react'
import { Button, Screen } from '../components'
import { lockVault } from '../lock'
import { AUTO_LOCK_CHOICES, getTheme, setAutoLockMinutes, setTheme, type ThemePref } from '../prefs'
import type { SyncService } from '../../sync/service'
import { BackupSection } from './BackupSection'
import { SecuritySection } from './SecuritySection'
import { DataSection, InstallSection, ReminderSection } from './SettingsSections'

const SELECT_STYLE =
  'min-h-11 rounded-xl border border-slate-500 bg-white px-3 text-base text-slate-900 dark:bg-slate-800 dark:text-slate-100'

interface Props {
  minutes: number
  onMinutesChange: (m: number) => void
  background: boolean
  onBackgroundChange: (on: boolean) => void
  sync: SyncService | null
  onSynced: () => Promise<void>
}

export function Settings({ minutes, onMinutesChange, background, onBackgroundChange, sync, onSynced }: Props) {
  const [theme, setThemeState] = useState<ThemePref>(getTheme)

  return (
    <Screen title="Settings">
      <Button onClick={lockVault}>Lock now</Button>

      <label className="flex flex-col gap-1">
        <span className="font-medium">Lock automatically after</span>
        <select
          className={SELECT_STYLE}
          value={minutes}
          onChange={(e) => {
            const m = Number(e.target.value)
            setAutoLockMinutes(m)
            onMinutesChange(m)
          }}
        >
          {AUTO_LOCK_CHOICES.map((m) => (
            <option key={m} value={m}>
              {m} {m === 1 ? 'minute' : 'minutes'} of no use
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="font-medium">Appearance</span>
        <select
          className={SELECT_STYLE}
          value={theme}
          onChange={(e) => {
            const t = e.target.value as ThemePref
            setTheme(t)
            setThemeState(t)
          }}
        >
          <option value="system">Match my device</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </label>

      <SecuritySection />
      <BackupSection sync={sync} onChanged={onSynced} />
      <ReminderSection background={background} onBackgroundChange={onBackgroundChange} />
      <InstallSection />
      <DataSection />

      <p className="text-sm text-slate-700 dark:text-slate-300">
        VaultKey 1.0 (release candidate). Everything stays on this device and is locked with your master password. VaultKey also locks when you close it.
      </p>
    </Screen>
  )
}
