import fs from 'node:fs'
import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { createVault, lockNow, MASTER, tab, unlock } from './helpers'

const NEW = 'granite lantern pepper walnut orbit kettle meadow'

const openPanel = async (page: Page, name: string) => {
  await tab(page, 'Settings').click()
  await page.getByRole('button', { name, exact: true }).click()
}

async function addEntry(page: Page, title: string, password: string) {
  await page.getByRole('button', { name: 'Add password' }).click()
  await page.getByLabel('Title').fill(title)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
}

async function forgotWithKey(page: Page, key: string, newPassword: string) {
  await page.getByRole('button', { name: 'I forgot my password' }).click()
  await page.getByLabel('Recovery key').fill(key)
  await page.getByLabel('New master password').fill(newPassword)
  await page.getByLabel('Type it again').fill(newPassword)
  const submit = page.getByRole('button', { name: 'Set new password and unlock' })
  await expect(submit).toBeEnabled({ timeout: 20_000 })
  await submit.click()
}

test('change the master password', async ({ page }) => {
  await createVault(page)
  await openPanel(page, 'Change master password')
  await page.getByLabel('Current master password').fill(MASTER)
  await page.getByLabel('New master password').fill(NEW)
  await page.getByLabel('Type it again').fill(NEW)
  const save = page.getByRole('button', { name: 'Save new master password' })
  await expect(save).toBeEnabled({ timeout: 20_000 })
  await save.click()
  await expect(page.getByText('Master password changed.')).toBeVisible({ timeout: 30_000 })

  await lockNow(page)
  await page.getByLabel('Master password').fill(MASTER)
  await page.getByRole('button', { name: 'Unlock' }).click()
  await expect(page.getByRole('alert')).toContainText(/didn.t work/, { timeout: 30_000 })
  await unlock(page, NEW)
})

test('a wrong current password changes nothing', async ({ page }) => {
  await createVault(page)
  await openPanel(page, 'Change master password')
  await page.getByLabel('Current master password').fill('not my password at all')
  await page.getByLabel('New master password').fill(NEW)
  await page.getByLabel('Type it again').fill(NEW)
  const save = page.getByRole('button', { name: 'Save new master password' })
  await expect(save).toBeEnabled({ timeout: 20_000 })
  await save.click()
  await expect(page.getByRole('alert').first()).toContainText(/didn.t work/, { timeout: 30_000 })
})

test('a new recovery key replaces the old one', async ({ page }) => {
  const oldKey = await createVault(page)
  await openPanel(page, 'Make a new recovery key')
  await page.getByLabel('Current master password').fill(MASTER)
  await page.getByRole('button', { name: 'Create new recovery key' }).click()
  await expect(page.getByTestId('recovery-key')).toBeVisible({ timeout: 30_000 })
  const newKey = ((await page.getByTestId('recovery-key').textContent()) ?? '').trim()
  expect(newKey).not.toBe(oldKey)
  await page.getByLabel('I saved my recovery key').check()
  await page.getByRole('button', { name: 'Use this recovery key' }).click()
  await expect(page.getByText('New recovery key saved.')).toBeVisible()

  await lockNow(page)
  await forgotWithKey(page, oldKey, NEW)
  await expect(page.getByRole('alert').first()).toContainText('doesn’t belong to this vault', { timeout: 30_000 })
  await page.getByLabel('Recovery key').fill(newKey)
  await page.getByRole('button', { name: 'Set new password and unlock' }).click()
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible({ timeout: 30_000 })
})

test('a new vault key keeps the passwords and retires the old recovery key', async ({ page }) => {
  const oldKey = await createVault(page)
  await addEntry(page, 'Keep this', 'keep-this-pass-1')
  await page.getByRole('button', { name: 'Back to vault' }).click()

  await openPanel(page, 'Make a new vault key (advanced)')
  await page.getByLabel('Current master password').fill(MASTER)
  const create = page.getByRole('button', { name: 'Create new vault key' })
  await expect(create).toBeDisabled() // needs the "I understand" box
  await page.getByLabel('I understand my other devices and old backups will stop working with this vault').check()
  await create.click()
  await expect(page.getByTestId('recovery-key')).toBeVisible({ timeout: 60_000 })
  await page.getByLabel('I saved my recovery key').check()
  await page.getByRole('button', { name: 'Finish' }).click()
  await expect(page.getByText('New vault key made.')).toBeVisible({ timeout: 30_000 })

  await lockNow(page)
  await unlock(page)
  await page.getByRole('button', { name: /Keep this/ }).click()
  await page.getByRole('button', { name: 'Show password' }).click()
  await expect(page.getByTestId('password-value')).toHaveText('keep-this-pass-1')

  await lockNow(page)
  await forgotWithKey(page, oldKey, NEW)
  await expect(page.getByRole('alert').first()).toContainText('doesn’t belong to this vault', { timeout: 30_000 })
})

async function saveBackup(page: Page, testInfo: TestInfo, name: string): Promise<string> {
  await tab(page, 'Settings').click()
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save a backup file' }).click()])
  const path = testInfo.outputPath(name)
  await download.saveAs(path)
  return path
}

test('another device can be brought up to date after a new vault key', async ({ page, browser, baseURL }, testInfo) => {
  await createVault(page)
  await addEntry(page, 'Shared entry', 'shared-pass-123')
  await page.getByRole('button', { name: 'Back to vault' }).click()
  const first = await saveBackup(page, testInfo, 'first.vaultkey')

  // device B starts from the first backup
  const fresh = await browser.newContext({ baseURL })
  const other = await fresh.newPage()
  await other.goto('/')
  await other.getByRole('button', { name: 'I already have a backup file' }).click()
  await other.getByLabel('Backup file').setInputFiles(first)
  await other.getByLabel('Master password').fill(MASTER)
  await other.getByRole('button', { name: 'Restore my vault' }).click()
  await expect(other.getByRole('navigation', { name: 'Main' })).toBeVisible({ timeout: 30_000 })

  // device A makes a new vault key and saves a new backup
  await openPanel(page, 'Make a new vault key (advanced)')
  await page.getByLabel('Current master password').fill(MASTER)
  await page.getByLabel('I understand my other devices and old backups will stop working with this vault').check()
  await page.getByRole('button', { name: 'Create new vault key' }).click()
  await expect(page.getByTestId('recovery-key')).toBeVisible({ timeout: 60_000 })
  await page.getByLabel('I saved my recovery key').check()
  await page.getByRole('button', { name: 'Finish' }).click()
  await expect(page.getByText('New vault key made.')).toBeVisible({ timeout: 30_000 })
  const second = await saveBackup(page, testInfo, 'second.vaultkey')
  expect(fs.readFileSync(second, 'utf8')).not.toBe(fs.readFileSync(first, 'utf8'))

  // device B replaces its vault from the new backup
  await tab(other, 'Settings').click()
  await other.getByRole('button', { name: 'Replace this vault with a backup file', exact: true }).click()
  await other.getByLabel('Backup file to use').setInputFiles(second)
  await other.getByLabel('Master password of that file').fill(MASTER)
  await other.getByLabel('I understand this replaces everything on this device').check()
  await other.getByRole('button', { name: 'Replace this vault', exact: true }).click()
  await expect(other.getByText('This device now has the vault from the file.')).toBeVisible({ timeout: 60_000 })
  await tab(other, 'Vault').click()
  await expect(other.getByRole('button', { name: /Shared entry/ })).toBeVisible()
  await fresh.close()
})

test('unlock with this device (a virtual passkey)', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'uses Chromium’s virtual authenticator')
  const cdp = await context.newCDPSession(page)
  await cdp.send('WebAuthn.enable')
  const options = {
    protocol: 'ctap2',
    ctap2Version: 'ctap2_1',
    transport: 'internal',
    hasResidentKey: true,
    hasUserVerification: true,
    isUserVerified: true,
    automaticPresenceSimulation: true,
    hasPrf: true,
  } as const
  try {
    await cdp.send('WebAuthn.addVirtualAuthenticator', { options })
  } catch {
    test.skip(true, 'this Chromium cannot simulate the passkey PRF extension')
  }

  await createVault(page)
  await openPanel(page, 'Unlock with fingerprint, face or device PIN')
  await page.getByLabel('Current master password').fill(MASTER)
  await page.getByRole('button', { name: 'Turn on' }).click()
  await expect(page.getByText('Unlocking with this device is on.')).toBeVisible({ timeout: 30_000 })

  await lockNow(page)
  await page.getByRole('button', { name: 'Unlock with this device' }).click()
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible({ timeout: 30_000 })
})
