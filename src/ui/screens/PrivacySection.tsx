import { Card } from '../components'

const items = [
  {
    title: 'Local encrypted storage',
    body: 'Vault entries are encrypted with AES-256-GCM before they are written to IndexedDB. What is on disk is ciphertext, not your passwords.',
  },
  {
    title: 'Browser memory',
    body: 'While unlocked, the vault key lives in memory as a non-extractable browser key. It is cleared when you lock or close the app.',
  },
  {
    title: 'Master password and recovery key',
    body: 'Neither your master password nor your recovery key is stored or transmitted. They exist only in your memory and on the paper or device you choose.',
  },
  {
    title: 'Preferences',
    body: 'Theme, auto-lock, and notification preferences are non-secret settings stored locally. They cannot open your vault.',
  },
  {
    title: 'Clipboard',
    body: 'Copied values are cleared from the clipboard after about 30 seconds. The app never reads the clipboard.',
  },
  {
    title: 'Network',
    body: 'The app is built to run offline. Its security policy blocks connections to any site other than where it was loaded from.',
  },
  {
    title: 'Backups and sync',
    body: 'Backup and sync files are encrypted before they leave this device. A cloud folder stores ciphertext only.',
  },
  {
    title: 'Device unlock',
    body: 'When supported, device unlock uses WebAuthn PRF. The biometric or PIN stays inside your device; VaultKey only receives a derived key.',
  },
]

export function PrivacySection() {
  return (
    <Card title="Privacy center">
      <p className="text-sm text-[rgb(var(--vk-text-muted))]">
        Where your information lives and how VaultKey keeps it private.
      </p>
      <dl className="grid gap-3">
        {items.map((item) => (
          <div key={item.title} className="rounded-xl border border-[rgb(var(--vk-border))] bg-[rgb(var(--vk-surface-2))] p-3">
            <dt className="font-semibold">{item.title}</dt>
            <dd className="mt-1 text-sm text-[rgb(var(--vk-text-muted))]">{item.body}</dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}