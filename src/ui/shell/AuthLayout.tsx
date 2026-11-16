import type { ReactNode } from 'react'

export function AuthLayout({ brand, title, subtitle, children, aside }: { brand?: string; title: string; subtitle?: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="min-h-dvh bg-[rgb(var(--vk-bg))] text-[rgb(var(--vk-text))]">
      <div className="mx-auto grid min-h-dvh w-full max-w-6xl lg:grid-cols-[1.1fr_minmax(0,480px)]">
        <aside className="relative hidden overflow-hidden bg-gradient-to-br from-indigo-900 via-slate-900 to-black p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="absolute inset-0 opacity-40" aria-hidden="true" style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(129,140,248,.35), transparent 35%), radial-gradient(circle at 80% 30%, rgba(96,165,250,.25), transparent 30%), radial-gradient(circle at 40% 80%, rgba(129,140,248,.2), transparent 30%)' }} />
          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-sm font-medium backdrop-blur">{brand ?? 'VaultKey'}</div>
            <h2 className="mt-8 text-4xl font-semibold tracking-tight">Your vault, on this device.</h2>
            <p className="mt-4 max-w-md text-base text-indigo-100">Encrypted locally. No account, no server. Recovery is yours alone.</p>
          </div>
          <div className="relative grid gap-3 text-sm text-indigo-100">
            {aside ?? (
              <>
                <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">Zero-knowledge by default. Decryption happens only on this device.</div>
                <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">Offline-first PWA with encrypted backups and recovery options.</div>
              </>
            )}
          </div>
        </aside>
        <main className="flex items-center justify-center px-4 py-8 sm:px-8">
          <div className="w-full max-w-md rounded-3xl border border-[rgb(var(--vk-border))] bg-[rgb(var(--vk-surface))] p-6 shadow-lg sm:p-8">
            <div className="mb-6">
              <p className="text-sm font-semibold text-[rgb(var(--vk-accent))] lg:hidden">{brand ?? 'VaultKey'}</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h1>
              {subtitle && <p className="mt-2 text-sm text-[rgb(var(--vk-text-muted))]">{subtitle}</p>}
            </div>
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
