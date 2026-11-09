import { useEffect, useState } from 'react'
import { disableBackground, enableBackground, backgroundSupported } from '../../pwa/background'
import { promptInstall } from '../../pwa/install'
import { isPersisted, requestPersistence } from '../../pwa/persist'
import { notificationPermission, requestNotificationPermission } from '../../reminders/notify'
import { Button, Toggle } from '../components'
import { useInstallKind } from '../hooks'
import { getNotifyEnabled, setBackgroundEnabled, setNotifyEnabled } from '../prefs'

const H2 = 'text-lg font-semibold'
const SMALL = 'text-sm text-slate-700 dark:text-slate-300'

export function ReminderSection({ background, onBackgroundChange }: { background: boolean; onBackgroundChange: (on: boolean) => void }) {
  const [permission, setPermission] = useState(notificationPermission)
  const [notify, setNotify] = useState(getNotifyEnabled)
  const [note, setNote] = useState('')
  const notifyOn = notify && permission === 'granted'

  const toggleNotify = async (wanted: boolean) => {
    if (!wanted) {
      setNotifyEnabled(false)
      setNotify(false)
      setBackgroundEnabled(false)
      onBackgroundChange(false)
      void disableBackground()
      setNote('')
      return
    }
    const result = await requestNotificationPermission() // must happen right after the tap
    setPermission(result)
    if (result === 'granted') {
      setNotifyEnabled(true)
      setNotify(true)
      setNote('')
    } else {
      setNote(result === 'unsupported' ? 'This browser can’t show notifications.' : 'Notifications are blocked. Allow them for VaultKey in your browser settings, then try again.')
    }
  }

  const toggleBackground = async (wanted: boolean) => {
    if (!wanted) {
      setBackgroundEnabled(false)
      onBackgroundChange(false)
      await disableBackground()
      setNote('')
      return
    }
    const result = await enableBackground()
    if (result === 'enabled') {
      setBackgroundEnabled(true)
      onBackgroundChange(true)
      setNote('')
    } else {
      setNote(
        result === 'unsupported'
          ? 'This browser can’t check in the background. Reminders will still show when you open VaultKey.'
          : 'The browser didn’t allow background checks. They usually need VaultKey to be installed as an app first.',
      )
    }
  }

  return (
    <section className="flex flex-col gap-1">
      <h2 className={H2}>Reminders</h2>
      <Toggle label="Tell me when passwords are due" checked={notifyOn} disabled={permission === 'unsupported'} onChange={(e) => void toggleNotify(e.target.checked)} />
      <p className={SMALL}>
        Shows a short message such as “2 passwords are due for a change”, at most once a day, when you open VaultKey. It never includes names. Due
        passwords are always listed in the Reminders tab.
      </p>
      <Toggle
        label="Also remind me when VaultKey is closed"
        checked={background && notifyOn}
        disabled={!notifyOn || !backgroundSupported()}
        onChange={(e) => void toggleBackground(e.target.checked)}
      />
      <p className={SMALL}>
        {backgroundSupported()
          ? 'To do this, VaultKey keeps the date of your next reminder (no names, nothing else) on this device only. It is never put in backups or sync files. Your browser decides when it checks, so timing is approximate.'
          : 'Not available in this browser. It works in some installed apps on Chrome and Edge.'}
      </p>
      <p role="status" className="text-sm">
        {note}
      </p>
    </section>
  )
}

export function InstallSection() {
  const kind = useInstallKind()
  const [note, setNote] = useState('')
  const offline = 'serviceWorker' in navigator && navigator.serviceWorker.controller !== null

  return (
    <section className="flex flex-col gap-2">
      <h2 className={H2}>Install on this device</h2>
      {kind === 'installed' && <p>VaultKey is installed on this device.</p>}
      {kind === 'prompt' && (
        <Button
          onClick={() =>
            void promptInstall().then((outcome) => setNote(outcome === 'accepted' ? 'Installed.' : outcome === 'dismissed' ? 'No problem. You can install it any time.' : ''))
          }
        >
          Install VaultKey
        </Button>
      )}
      {kind === 'ios' && <p>To install: tap the Share button in Safari, then choose “Add to Home Screen”.</p>}
      {kind === 'manual' && (
        <p>To install: on a computer, look for an install icon in the address bar, or open the browser menu and choose “Install VaultKey”. On a phone, use the menu and choose “Install app” or “Add to Home screen”.</p>
      )}
      <p role="status" className="text-sm">
        {note}
      </p>
      <p className={SMALL}>{offline ? 'Works without internet: ready.' : 'Works without internet: getting ready. Reload once if this stays.'}</p>
    </section>
  )
}

export function DataSection() {
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const [note, setNote] = useState('')
  useEffect(() => {
    void isPersisted().then(setPersisted)
  }, [])

  const protect = async () => {
    const result = await requestPersistence()
    setPersisted(result === 'granted')
    setNote(result === 'granted' ? '' : 'Your browser didn’t allow it. Installing VaultKey usually helps.')
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className={H2}>Keep my data safe</h2>
      {persisted ? (
        <p>Your browser won’t clear VaultKey’s data when your device runs low on space.</p>
      ) : (
        <>
          <p>
            Your browser may clear VaultKey’s saved data if your device runs low on space, or if you don’t use the app for a while (Safari does this after about
            a week). Installing the app helps. Backups are coming in a later update.
          </p>
          <Button variant="secondary" onClick={() => void protect()} className="self-start">
            Protect my data
          </Button>
        </>
      )}
      <p role="status" className="text-sm">
        {note}
      </p>
    </section>
  )
}
