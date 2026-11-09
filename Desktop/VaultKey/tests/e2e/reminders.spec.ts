import { expect, test } from '@playwright/test'
import { createVault, tab } from './helpers'

test('a reminder becomes overdue, and confirming a new password resets it', async ({ page }) => {
  await page.clock.install()
  await createVault(page)

  // a password with a reminder every 2 weeks
  await page.getByRole('button', { name: 'Add password' }).click()
  await page.getByLabel('Title').fill('Example bank')
  await page.getByLabel('Password', { exact: true }).fill('old-password-123')
  await page.getByLabel('Remind me to change this password').check()
  await page.getByLabel('Every', { exact: true }).fill('2')
  await page.getByLabel('Unit').selectOption('week')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText(/every 2 weeks/)).toBeVisible()
  await page.getByRole('button', { name: 'Back to vault' }).click()
  await expect(page.getByText(/due for a change/)).toHaveCount(0)

  // 16 days later it is overdue: the banner and the badge both say so
  await page.clock.setSystemTime(new Date(Date.now() + 16 * 24 * 60 * 60 * 1000))
  await tab(page, 'Generator').click()
  await tab(page, 'Vault').click()
  await expect(page.getByText('1 password is due for a change.')).toBeVisible()
  await expect(tab(page, 'Reminders')).toContainText('1')
  await page.getByRole('button', { name: 'Review' }).click()
  await expect(page.getByRole('heading', { name: 'Overdue' })).toBeVisible()
  await expect(page.getByText(/Overdue by 2 days/)).toBeVisible()

  // the suggestion is not saved until it is confirmed
  await page.getByRole('button', { name: 'Change password for Example bank' }).click()
  const suggested = (await page.getByTestId('suggested-password').textContent()) ?? ''
  expect(suggested).toHaveLength(20)
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByText(/Overdue by 2 days/)).toBeVisible()

  await page.getByRole('button', { name: 'Change password for Example bank' }).click()
  await page.getByRole('button', { name: 'Save new password' }).click()
  await expect(page.getByText('Nothing is due.')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Coming up' })).toBeVisible()

  // the old password is kept in history
  await tab(page, 'Vault').click()
  await page.getByRole('button', { name: /Example bank/ }).click()
  await expect(page.getByText('1 earlier password is kept.')).toBeVisible()
})

test('turning the reminder off removes it', async ({ page }) => {
  await createVault(page)
  await page.getByRole('button', { name: 'Add password' }).click()
  await page.getByLabel('Title').fill('Gym')
  await page.getByLabel('Remind me to change this password').check()
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText(/every 3 months/)).toBeVisible()
  await page.getByRole('button', { name: 'Edit' }).click()
  await page.getByLabel('Remind me to change this password').uncheck()
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText(/every 3 months/)).toHaveCount(0)
  await tab(page, 'Reminders').click()
  await expect(page.getByText(/No reminders yet/)).toBeVisible()
})
