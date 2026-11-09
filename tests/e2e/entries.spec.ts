import { expect, test, type Page } from '@playwright/test'
import { createVault, lockNow, unlock } from './helpers'

async function addEntry(page: Page, title: string, username: string, tags: string) {
  await page.getByRole('button', { name: 'Add password' }).click()
  await page.getByLabel('Title').fill(title)
  await page.getByLabel('Username or email').fill(username)
  await page.getByLabel('Website').fill(`${title.split(' ')[0]?.toLowerCase()}.example.com`)
  await page.getByRole('button', { name: 'Generate' }).click()
  await page.getByLabel('Tags').fill(tags)
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
}

test('save, find, reveal, copy, edit and delete a password', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await createVault(page)
  await expect(page.getByText('No passwords yet')).toBeVisible()

  await addEntry(page, 'Example bank', 'sam@example.com', 'money, personal')

  // hidden by default, then shown, then copied
  const value = page.getByTestId('password-value')
  await expect(value).toHaveText(/^•+$/)
  await page.getByRole('button', { name: 'Show password' }).click()
  const password = (await value.textContent()) ?? ''
  expect(password).toHaveLength(20)
  await page.getByRole('button', { name: 'Copy password' }).click()
  await expect(page.getByRole('status')).toContainText('Password copied')
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(password)
  await page.getByRole('button', { name: 'Hide password' }).click()
  await expect(value).toHaveText(/^•+$/)

  // search and tag filter
  await page.getByRole('button', { name: 'Back to vault' }).click()
  await addEntry(page, 'Work email', 'sam@work.example', 'work')
  await page.getByRole('button', { name: 'Back to vault' }).click()
  await page.getByLabel('Search').fill('nothing like this')
  await expect(page.getByText('Nothing matches your search.')).toBeVisible()
  await page.getByLabel('Search').fill('bank')
  await expect(page.getByRole('button', { name: /Example bank/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Work email/ })).toHaveCount(0)
  await page.getByLabel('Search').fill('')
  await page.getByRole('button', { name: 'work', exact: true }).click()
  await expect(page.getByRole('button', { name: /Example bank/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'work', exact: true }).click()

  // survives lock + reload, and the password is the same
  await lockNow(page)
  await page.reload()
  await unlock(page)
  await page.getByRole('button', { name: /Example bank/ }).click()
  await page.getByRole('button', { name: 'Show password' }).click()
  await expect(page.getByTestId('password-value')).toHaveText(password)

  // edit
  await page.getByRole('button', { name: 'Edit' }).click()
  await page.getByLabel('Title').fill('Example bank (joint)')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Example bank (joint)' })).toBeVisible()

  // changing the password keeps the old one in history
  await page.getByRole('button', { name: 'Edit' }).click()
  await page.getByRole('button', { name: 'Generate' }).click()
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText('1 earlier password is kept.')).toBeVisible()

  // delete needs a second tap
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page.getByText('This can’t be undone.')).toBeVisible()
  await page.getByRole('button', { name: 'Yes, delete' }).click()
  await expect(page.getByRole('button', { name: /Example bank/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Work email/ })).toBeVisible()
})

test('a title is required', async ({ page }) => {
  await createVault(page)
  await page.getByRole('button', { name: 'Add password' }).click()
  await page.getByLabel('Title').fill('   ')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Give this password a title.')
})

test('only web addresses become links', async ({ page }) => {
  await createVault(page)
  await page.getByRole('button', { name: 'Add password' }).click()
  await page.getByLabel('Title').fill('Sneaky')
  await page.getByLabel('Website').fill('javascript:alert(1)')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Sneaky' })).toBeVisible()
  await expect(page.getByRole('link')).toHaveCount(0)
})

test('hash tool: SHA-256 of "abc" and the plain-language notice', async ({ page }) => {
  await createVault(page)
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Generator' }).click()
  await page.getByText('Hash some text (advanced)').click()
  await expect(page.getByText('not how VaultKey protects your vault')).toBeVisible()
  await page.getByLabel('Text to hash').fill('abc')
  await page.getByRole('button', { name: 'Hash it' }).click()
  await expect(page.getByTestId('hash-result')).toHaveText('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
})
