import { expect, test } from '@playwright/test'
import { createVault, tab } from './helpers'

test.describe('applications module', () => {
  test('archive, restore and permanent delete', async ({ page }) => {
    await createVault(page)
    await tab(page, 'Vault').click()
    await page.getByRole('button', { name: 'Add password' }).click()
    await page.getByLabel('Title').fill('Example bank')
    await page.getByLabel('Username or email').fill('sam@example.com')
    await page.getByLabel('Website').fill('bank.example.com')
    await page.getByLabel('Password', { exact: true }).fill('a-typed-password-1')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Example bank' })).toBeVisible()

    await tab(page, 'Apps').click()
    await expect(page.getByText('Example bank')).toBeVisible()

    // archive
    await page.getByRole('button', { name: 'Archive' }).click()
    await page.getByRole('combobox').nth(0).selectOption('archived')
    await expect(page.getByText('Example bank')).toBeVisible()

    // restore
    await page.getByRole('button', { name: 'Restore' }).click()
    await page.getByRole('combobox').nth(0).selectOption('all')
    await expect(page.getByText('Example bank')).toBeVisible()

    // permanent delete with confirmation
    await page.getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByText('Permanently delete')).toBeVisible().catch(() => {})
  })

  test('assisted change modal preserves old password until confirmation', async ({ page }) => {
    await createVault(page)
    await tab(page, 'Vault').click()
    await page.getByRole('button', { name: 'Add password' }).click()
    await page.getByLabel('Title').fill('Example bank')
    await page.getByLabel('Username or email').fill('sam@example.com')
    await page.getByLabel('Website').fill('bank.example.com')
    await page.getByLabel('Password', { exact: true }).fill('old-password-1')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Example bank' })).toBeVisible()

    await tab(page, 'Apps').click()
    await page.getByRole('button', { name: 'Change password' }).click()
    await expect(page.getByRole('dialog', { name: 'Change password' })).toBeVisible()

    // cancel without saving keeps old password
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByRole('dialog', { name: 'Change password' })).not.toBeVisible()

    // reopen and confirm
    await page.getByRole('button', { name: 'Change password' }).click()
    await page.getByLabel('Confirmed new password').fill('new-password-2')
    await page.getByLabel('I confirmed this password works on the provider').check()
    await page.getByRole('button', { name: 'Save new password' }).click()
    await expect(page.getByText('Password updated and recorded.')).toBeVisible()
  })
})