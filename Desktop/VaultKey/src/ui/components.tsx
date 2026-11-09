import { useEffect, useId, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react'
import type { Strength } from '../generator'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' }

const BUTTON_STYLES = {
  primary: 'bg-blue-800 text-white hover:bg-blue-900 dark:bg-blue-300 dark:text-slate-900 dark:hover:bg-blue-200',
  secondary:
    'border border-slate-400 bg-transparent text-slate-900 hover:bg-slate-100 dark:border-slate-500 dark:text-slate-100 dark:hover:bg-slate-800',
  danger: 'bg-red-800 text-white hover:bg-red-900 dark:bg-red-300 dark:text-slate-900 dark:hover:bg-red-200',
}

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  return (
    <button
      type="button"
      className={`min-h-11 rounded-xl px-5 py-2 text-base font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${BUTTON_STYLES[variant]} ${className}`}
      {...props}
    />
  )
}

export function Field({ label, hint, error, ...input }: { label: string; hint?: string; error?: string } & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="font-medium">
        {label}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-slate-700 dark:text-slate-300">
          {hint}
        </p>
      )}
      <input
        id={id}
        aria-describedby={hint ? `${id}-hint` : undefined}
        aria-invalid={error ? true : undefined}
        className="min-h-11 rounded-xl border border-slate-500 bg-white px-3 text-base text-slate-900 dark:bg-slate-800 dark:text-slate-100"
        {...input}
      />
      {error && (
        <p role="alert" className="text-sm font-medium text-red-800 dark:text-red-300">
          {error}
        </p>
      )}
    </div>
  )
}

export function TextArea({ label, ...input }: { label: string } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="font-medium">
        {label}
      </label>
      <textarea
        id={id}
        rows={4}
        className="rounded-xl border border-slate-500 bg-white px-3 py-2 text-base text-slate-900 dark:bg-slate-800 dark:text-slate-100"
        {...input}
      />
    </div>
  )
}

export function Toggle({ label, ...input }: { label: string } & Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  return (
    <label className="flex min-h-11 items-center gap-3">
      <input type="checkbox" className="h-6 w-6 shrink-0 accent-blue-800 dark:accent-blue-300" {...input} />
      <span>{label}</span>
    </label>
  )
}

const SEGMENT_COLORS = ['bg-red-700', 'bg-orange-700', 'bg-yellow-700', 'bg-green-700', 'bg-emerald-700']

export function StrengthMeter({ strength }: { strength: Strength | null }) {
  const level = strength?.level ?? -1
  return (
    <div className="flex flex-col gap-1">
      <div
        role="meter"
        aria-label="Password strength"
        aria-valuemin={0}
        aria-valuemax={4}
        aria-valuenow={Math.max(level, 0)}
        aria-valuetext={strength ? strength.label : 'Not rated yet'}
        className="flex gap-1"
      >
        {SEGMENT_COLORS.map((color, i) => (
          <span key={color} className={`h-2 flex-1 rounded-full ${i <= level ? color : 'bg-slate-300 dark:bg-slate-600'}`} />
        ))}
      </div>
      <p className="text-sm">
        {strength ? (
          <>
            <strong>{strength.label}.</strong> A fast attacker with a stolen copy could guess it {strength.crackTime}.
            {strength.hint ? ` ${strength.hint}` : ''}
          </>
        ) : (
          'Type a password to see how strong it is.'
        )}
      </p>
    </div>
  )
}

export function Screen({ title, children }: { title: string; children: ReactNode }) {
  const heading = useRef<HTMLHeadingElement>(null)
  // A new screen replaces the one that had focus. Moving focus to its heading tells screen readers where they are
  // and keeps keyboard users from being dropped back at the top of the page.
  useEffect(() => {
    heading.current?.focus({ preventScroll: true })
  }, [])
  return (
    <section className="flex max-w-xl flex-col gap-5">
      <h1 ref={heading} tabIndex={-1} className="text-2xl font-bold focus:outline-none">
        {title}
      </h1>
      {children}
    </section>
  )
}
