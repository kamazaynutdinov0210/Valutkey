# Frontend Design Library Audit

## Installed libraries

Dependencies (package.json): React, React DOM, @scure/bip39, @zxcvbn-ts/*, hash-wasm.
Dev: Tailwind 3, PostCSS, Autoprefixer, Vite, Playwright, Vitest, axe.
No animation/UI component libraries installed.

## Libraries actually used

- Tailwind CSS 3 (utility classes) — used across all screens.
- Native CSS transitions (Tailwind `transition-colors`, `transition-opacity`, `motion-reduce:transition-none`).
- Native `animate-pulse` for skeletons (Tailwind).
- No framer-motion, no Radix, no Vengeance UI, no Animaster.

## Screens using external components

None. All UI components are custom in `src/ui/components.tsx` (Button, Field, Card, Toggle, Screen, StrengthMeter, etc.).

## Screens using custom CSS

All screens use Tailwind utility classes; no separate CSS files per screen. `src/index.css` defines base styles and reduced-motion.

## Missing requested integrations

- Animaster: not installed or used anywhere.
- Vengeance UI: not installed or used anywhere. (It is a shadcn-style registry for marketing/animated components, requires framer-motion/clsx/tailwind-merge/lucide-react/Radix.)

## Design quality evaluation

- Modern professional appearance: yes, neutral slate palette, clear hierarchy.
- Typography: Tailwind default (system fonts); consistent sizes.
- Spacing/alignment: generally consistent (gap-2/3/4, p-3/4).
- Button/toggle animations: CSS transition-colors (removed from Button to fix axe mid-transition); Toggle uses native checkbox.
- Sidebar: bottom tab bar on phone, sidebar on md+.
- Cards/tables: Card component; lists not tables.
- Dialogs/modals: custom div-based modal in Applications; alertdialog for delete.
- Loading skeletons: animate-pulse divs in Applications; text "Opening..." elsewhere.
- Empty states: present in Vault, Applications, Dashboard.
- Light/dark: supported via Tailwind dark: and prefers-color-scheme.
- Responsive: yes (md breakpoints, 360px tested).
- Accessibility: axe WCAG 2.2 AA on desktop/phone light/dark passes. Reduced-motion respected via global CSS.

## Recommended improvements

- Toasts: currently a single inline toast in Applications; consider a shared toast component (custom, no library).
- Skeletons: reuse a shared Skeleton component.
- Modals: add focus trap and focus restoration (currently none).
- Animations: keep CSS-based; avoid adding framer-motion to limit bundle size.

## Dependency/bundle impact

- Adding Vengeance UI would require framer-motion (~30KB+ gzipped), clsx, tailwind-merge, lucide-react, and Radix primitives, increasing bundle and maintenance. Not recommended for this offline-first PWA.
- Animaster is not a known standard library; no integration proposed.

## Conclusion

Neither requested library is integrated. The application uses a custom Tailwind-based design system with CSS transitions. Recommend keeping this approach to preserve bundle size and offline performance.