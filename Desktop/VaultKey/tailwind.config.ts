import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  // Dark when the device is dark (unless the person chose Light), or when they chose Dark.
  darkMode: [
    'variant',
    ['@media (prefers-color-scheme: dark) { &:not([data-theme="light"] *) }', '&:is([data-theme="dark"] *)'],
  ],
  theme: { extend: {} },
  plugins: [],
} satisfies Config
