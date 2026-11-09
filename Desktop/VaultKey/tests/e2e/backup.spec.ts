import fs from 'node:fs'
import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { createVault, MASTER, tab } from './helpers'

async function addEntry(page: Page, title: string, password: string) {
  await page.getByRole('button', { name: 'Add password' }).click()
  await page.getByLabel('Title').fill(title)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
  await page.getByRole('button', { name: 'Back to vault' }).click()
}

async function saveBackup(page: Page, testInfo: TestInfo): Promise<string> {
  await tab(page, 'Settings').click()
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save a backup file' }).click()])
  expect(download.suggestedFilename()).toMatch(/^vaultkey-backup-\d{4}-\d{2}-\d{2}\.vaultkey$/)
  const path = testInfo.outputPath('backup.vaultkey')
  await download.saveAs(path)
  return path
}

test('save a backup, then restore it on a device with nothing', async ({ page, browser, baseURL }, testInfo) => {
  await createVault(page)
  await addEntry(page, 'Backup bank', 'backup-pass-123')
  const path = await saveBackup(page, testInfo)
  const text = fs.readFileSync(path, 'utf8')
  expect(text).not.toContain('Backup bank')
  expect(text).not.toContain('backup-pass-123')

  const fresh = await browser.newContext({ baseURL })
  const other = await fresh.newPage()
  await other.goto('/')
  await other.getByRole('button', { name: 'I already have a backup file' }).click()
  await other.getByLabel('Backup file').setInputFiles(path)
  await other.getByLabel('Master password').fill(MASTER)
  await other.getByRole('button', { name: 'Restore my vault' }).click()
  await expect(other.getByRole('navigation', { name: 'Main' })).toBeVisible({ timeout: 30_000 })
  await other.getByRole('button', { name: /Backup bank/ }).click()
  await other.getByRole('button', { name: 'Show password' }).click()
  await expect(other.getByTestId('password-value')).toHaveText('backup-pass-123')
  await fresh.close()
})

test('restore refuses a wrong password, and works with the recovery key', async ({ page, browser, baseURL }, testInfo) => {
  const recoveryKey = await createVault(page)
  await addEntry(page, 'Keep me', 'keep-me-pass-1')
  const path = await saveBackup(page, testInfo)

  const fresh = await browser.newContext({ baseURL })
  const other = await fresh.newPage()
  await other.goto('/')
  await other.getByRole('button', { name: 'I already have a backup file' }).click()
  await other.getByLabel('Backup file').setInputFiles(path)
  await other.getByLabel('Master password').fill('definitely the wrong password')
  await other.getByRole('button', { name: 'Restore my vault' }).click()
  await expect(other.getByRole('alert')).toContainText(/didn.t work/, { timeout: 30_000 })

  await other.getByLabel('Use my recovery key instead').check()
  await other.getByLabel('Recovery key', { exact: true }).fill(recoveryKey)
  await other.getByRole('button', { name: 'Restore my vault' }).click()
  await expect(other.getByRole('navigation', { name: 'Main' })).toBeVisible({ timeout: 30_000 })
  await fresh.close()
})

test('a damaged backup is refused', async ({ page, browser, baseURL }, testInfo) => {
  await createVault(page)
  await addEntry(page, 'Entry', 'entry-pass-1')
  const path = await saveBackup(page, testInfo)
  const file = JSON.parse(fs.readFileSync(path, 'utf8'))
  file.records.pop() // someone removed an entry from the file
  const broken = testInfo.outputPath('broken.vaultkey')
  fs.writeFileSync(broken, JSON.stringify(file))

  const fresh = await browser.newContext({ baseURL })
  const other = await fresh.newPage()
  await other.goto('/')
  await other.getByRole('button', { name: 'I already have a backup file' }).click()
  await other.getByLabel('Backup file').setInputFiles(broken)
  await other.getByLabel('Master password').fill(MASTER)
  await other.getByRole('button', { name: 'Restore my vault' }).click()
  await expect(other.getByRole('alert')).toContainText('damaged or has been changed', { timeout: 30_000 })
  await expect(other.getByRole('navigation', { name: 'Main' })).toHaveCount(0)
  await fresh.close()
})

test('a file that is not a backup is refused straight away', async ({ page }, testInfo) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'I already have a backup file' }).click()
  const junk = testInfo.outputPath('junk.vaultkey')
  fs.writeFileSync(junk, 'hello')
  await page.getByLabel('Backup file').setInputFiles(junk)
  await expect(page.getByRole('alert')).toContainText('isn’t a VaultKey file')
})

test('merging a backup into the same vault changes nothing the second time', async ({ page }, testInfo) => {
  await createVault(page)
  await addEntry(page, 'Only one', 'only-one-pass-1')
  const path = await saveBackup(page, testInfo)
  await page.getByLabel('Choose a backup file to merge').setInputFiles(path)
  await expect(page.getByText('Everything was already up to date.')).toBeVisible({ timeout: 30_000 })
  await tab(page, 'Vault').click()
  await expect(page.getByRole('button', { name: /Only one/ })).toHaveCount(1)
})
