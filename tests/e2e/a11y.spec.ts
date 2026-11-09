import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { createVault, tab } from './helpers'

// WCAG 2.1 levels A and AA: the standard the project promises. (Best-practice rules are not part of it.)
const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

/** Runs the scan and adds each distinct problem to `found` (rule + element), so one run reports everything. */
async function scan(page: Page, where: string, found: Map<string, string>) {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze()
  for (const v of violations) {
    for (const node of v.nodes) {
      const target = node.target.join(' ')
      const key = `${v.id} ${target}`
      if (found.has(key)) continue
      const detail = (node.failureSummary ?? '').split('\n').slice(1, 3).join(' ').replace(/\s+/g, ' ').trim().slice(0, 260)
      found.set(key, `[${where}] ${v.id} (${v.impact}) ${target}\n      ${v.help}. ${detail}`)
    }
  }
}

async function addEntry(page: Page) {
  await page.getByRole('button', { name: 'Add password' }).click()
  await page.getByLabel('Title').fill('Example bank')
  await page.getByLabel('Username or email').fill('sam@example.com')
  await page.getByLabel('Website').fill('bank.example.com')
  await page.getByLabel('Password', { exact: true }).fill('a-typed-password-1')
  await page.getByLabel('Remind me to change this password').check()
  await page.getByLabel('Tags').fill('money')
}

for (const scheme of ['light', 'dark'] as const) {
  test(`no WCAG A/AA problems on any screen (${scheme} mode)`, async ({ page }) => {
    test.setTimeout(180_000)
    const found = new Map<string, string>()
    await page.emulateMedia({ colorScheme: scheme })

    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Welcome to VaultKey' })).toBeVisible()
    await scan(page, 'first screen', found)
    await page.getByRole('button', { name: 'I already have a backup file' }).click()
    await scan(page, 'restore screen', found)
    await page.getByRole('button', { name: 'Back' }).click()

    await createVault(page)
    await scan(page, 'empty vault', found)

    await addEntry(page)
    await scan(page, 'add-password form', found)
    await page.getByText('Password style').click()
    await scan(page, 'add-password form with password style open', found)
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Example bank' })).toBeVisible()
    await page.getByRole('button', { name: 'Show password' }).click()
    await scan(page, 'password details', found)
    await page.getByRole('button', { name: 'Back to vault' }).click()
    await scan(page, 'vault list', found)

    await tab(page, 'Generator').click()
    await scan(page, 'generator (password)', found)
    await page.getByRole('button', { name: 'Passphrase' }).click()
    await scan(page, 'generator (passphrase)', found)
    await page.getByText('Check a password you already use').click()
    await page.getByText('Hash some text (advanced)').click()
    await scan(page, 'generator with tools open', found)

    await tab(page, 'Reminders').click()
    await scan(page, 'reminders', found)

    await tab(page, 'Settings').click()
    await scan(page, 'settings', found)
    for (const panel of [
      'Change master password',
      'Make a new recovery key',
      'Unlock with fingerprint, face or device PIN',
      'Make a new vault key (advanced)',
      'Replace this vault with a backup file',
    ]) {
      await page.getByRole('button', { name: panel, exact: true }).click()
      await scan(page, `settings: ${panel}`, found)
      await page.getByRole('button', { name: panel, exact: true }).click()
    }

    expect([...found.values()], `${found.size} accessibility problem(s) in ${scheme} mode`).toEqual([])
  })
}

test('moving to another screen moves keyboard focus to its heading', async ({ page }) => {
  await createVault(page)
  await tab(page, 'Generator').click()
  await expect(page.getByRole('heading', { name: 'Generator' })).toBeFocused()
  await tab(page, 'Settings').click()
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeFocused()
})

test('everything you tap or type into is at least 44 px tall', async ({ page }) => {
  test.setTimeout(120_000)
  const tooSmall = () =>
    page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('button, select, summary, textarea, input:not([type=checkbox]):not([type=radio]):not([type=hidden]):not(.sr-only)')]
        .filter((el) => {
          const box = el.getBoundingClientRect()
          return box.width > 0 && box.height > 0 && getComputedStyle(el).visibility !== 'hidden' && box.height < 43.5
        })
        .map((el) => `${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 40)}" is ${Math.round(el.getBoundingClientRect().height)}px`),
    )

  await page.goto('/')
  expect(await tooSmall(), 'first screen').toEqual([])
  await createVault(page)
  expect(await tooSmall(), 'vault').toEqual([])
  await addEntry(page)
  expect(await tooSmall(), 'add-password form').toEqual([])
  await page.getByRole('button', { name: 'Cancel' }).click()
  for (const name of ['Generator', 'Reminders', 'Settings']) {
    await tab(page, name).click()
    expect(await tooSmall(), name).toEqual([])
  }
})
