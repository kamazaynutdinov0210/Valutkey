# VaultKey design system

VaultKey uses a dark forest-green cybersecurity visual identity. The theme is driven by CSS custom properties in `src/index.css`, consumed through Tailwind arbitrary values such as `bg-[rgb(var(--vk-surface))]`.

## Color tokens

Light and dark values are defined in `:root`, `@media (prefers-color-scheme: dark)`, and manual `[data-theme]` overrides.

- `--vk-bg` — page background
- `--vk-surface` — cards and panels
- `--vk-surface-2` — inputs and secondary surfaces
- `--vk-border` — borders
- `--vk-text` — primary text
- `--vk-text-muted` — secondary text
- `--vk-accent` — links and focus accents
- `--vk-accent-strong` — solid accent buttons (white text, >= 4.5:1)
- `--vk-accent-stronger` — hover state for solid accent buttons
- `--vk-accent-soft` — selected navigation and soft highlights
- `--vk-success`, `--vk-warning`, `--vk-danger` — status colors

## Typography

- UI: Inter / system sans-serif
- Technical values: JetBrains Mono (passwords, recovery keys, hashes, metadata)

## Accessibility

- All interactive elements use visible focus rings.
- Color pairs maintain WCAG 2.2 AA contrast (>= 4.5:1 for normal text).
- Reduced motion is respected globally.
- No hover opacity is used on white-text buttons.