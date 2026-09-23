import { expect, test } from './support/workspace'

test('creates, edits, and deletes a task', async ({ page, workspace }) => {
  /** Saves each change through the API and survives a reload. */
  await workspace.open({ tasks: [] })
  await page.getByRole('button', { name: 'New task', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByLabel('Title', { exact: true })).toBeFocused()
  await dialog.getByLabel('Title', { exact: true }).fill('Write notes')
  await dialog.getByLabel('Description').fill('Meeting notes')
  await dialog.getByLabel('Due date', { exact: true }).fill('2026-11-12')
  await expect(dialog.getByLabel('Assigned to')).toContainText('Bruno Costa')
  await dialog.getByLabel('Assigned to').selectOption('2')
  await dialog.getByRole('button', { name: 'Save task' }).click()
  await expect(dialog).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Write notes' })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Tasks' })).toContainText(
    'Bruno Costa · Due 2026-11-12',
  )
  await page.getByRole('button', { name: 'Edit Write notes' }).click()
  await expect(dialog.getByLabel('Description')).toHaveValue('Meeting notes')
  await dialog.getByLabel('Title', { exact: true }).fill('Updated notes')
  await dialog.getByLabel('Due date', { exact: true }).fill('')
  await dialog.getByLabel('Assigned to').selectOption('unassigned')
  await dialog.getByRole('button', { name: 'Save task' }).click()
  await expect(
    page.getByRole('heading', { name: 'Updated notes' }),
  ).toBeVisible()
  await expect(page.getByRole('list', { name: 'Tasks' })).toContainText(
    'Unassigned · No due date',
  )
  await page.getByRole('button', { name: 'Edit Updated notes' }).click()
  page.once('dialog', (confirmation) => confirmation.accept())
  await dialog.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page.getByText('No tasks found.')).toBeVisible()
  await page.reload()
  await expect(page.getByText('No tasks found.')).toBeVisible()
})

test('keeps form values when the backend rejects a task', async ({
  page,
  workspace,
}) => {
  /** Shows server validation without losing the draft. */
  await workspace.open()
  await page.route('**/api/tasks/4/', (route) =>
    route.fulfill({
      status: 400,
      json: { title: ['This title is not allowed.'] },
    }),
  )
  await page.getByRole('button', { name: 'Edit Prepare report' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Title', { exact: true }).fill('Rejected title')
  await dialog.getByRole('button', { name: 'Save task' }).click()
  await expect(dialog.getByRole('alert')).toHaveText(
    'This title is not allowed.',
  )
  await expect(dialog.getByLabel('Title', { exact: true })).toHaveValue(
    'Rejected title',
  )
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Edit Prepare report' }),
  ).toBeFocused()
})

test('saves a status change and keeps the saved status after a failure', async ({
  page,
  workspace,
}) => {
  /** Displays server state after successful and rejected writes. */
  await workspace.open()
  const status = page.getByLabel('Status for Prepare report')
  await status.selectOption('done')
  await expect(status).toBeEnabled()
  await expect(status).toHaveValue('done')
  await page.reload()
  await expect(status).toHaveValue('done')
  await page.route('**/api/tasks/4/status/', (route) =>
    route.fulfill({ status: 500 }),
  )
  await status.selectOption('blocked')
  await expect(page.getByRole('alert')).toContainText('Please try again.')
  await expect(status).toHaveValue('done')
})
