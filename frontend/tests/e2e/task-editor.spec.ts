import { chooseOption } from './support/select'
import { expect, test } from './support/workspace'

test('validates a task title before sending it to the server', async ({
  page,
  workspace,
}) => {
  /** Preserves the draft and allows correction after validation fails. */
  await workspace.open({ tasks: [] })
  let writes = 0
  page.on('request', (request) => {
    if (
      new URL(request.url()).pathname === '/api/tasks/' &&
      request.method() === 'POST'
    )
      writes += 1
  })
  await page.getByRole('button', { name: 'New task', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Title', { exact: true }).fill('   ')
  await dialog.getByLabel('Description').fill('Keep this draft')
  await dialog.getByRole('button', { name: 'Save task' }).click()
  await expect(dialog.getByRole('alert')).toHaveText('Enter a task title.')
  await expect(dialog.getByLabel('Title', { exact: true })).toHaveAttribute('aria-invalid', 'true')
  await expect(dialog.getByLabel('Title', { exact: true })).toHaveAccessibleDescription('Enter a task title.')
  await expect(dialog.getByLabel('Description')).toHaveValue('Keep this draft')
  expect(writes).toBe(0)
  await dialog.getByLabel('Title', { exact: true }).fill('Validated task')
  await dialog.getByRole('button', { name: 'Save task' }).click()
  await expect(
    page.getByRole('heading', { name: 'Validated task' }),
  ).toBeVisible()
  expect(writes).toBe(1)
})

test('creates, edits, and deletes a task', async ({ page, workspace }) => {
  /** Saves each change through the API and survives a reload. */
  await workspace.open({ tasks: [] })
  await page.getByRole('button', { name: 'New task', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByLabel('Title', { exact: true })).toBeFocused()
  await dialog.getByLabel('Title', { exact: true }).fill('Write notes')
  await dialog.getByLabel('Description').fill('Meeting notes')
  await dialog.getByLabel('Due date', { exact: true }).fill('2026-11-12')
  await chooseOption(page, dialog.getByLabel('Assigned to'), 'Bruno Costa')
  await dialog.getByRole('button', { name: 'Save task' }).click()
  await expect(dialog).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Write notes' })).toBeVisible()
  const board = page.getByRole('region', { name: 'Task board' })
  await expect(board).toContainText('Bruno Costa')
  await expect(board).toContainText('Due Nov 12, 2026')
  await page.getByRole('button', { name: 'Edit Write notes' }).click()
  await expect(dialog.getByLabel('Description')).toHaveValue('Meeting notes')
  await dialog.getByLabel('Title', { exact: true }).fill('Updated notes')
  await dialog.getByLabel('Due date', { exact: true }).fill('')
  await chooseOption(page, dialog.getByLabel('Assigned to'), 'Unassigned')
  await dialog.getByRole('button', { name: 'Save task' }).click()
  await expect(
    page.getByRole('heading', { name: 'Updated notes' }),
  ).toBeVisible()
  await expect(board).toContainText('Unassigned')
  await expect(board).toContainText('No due date')
  await page.getByRole('button', { name: 'Edit Updated notes' }).click()
  await dialog.getByRole('button', { name: 'Delete', exact: true }).click()
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Delete', exact: true })
    .click()
  await expect(board.getByText('No tasks', { exact: true })).toHaveCount(5)
  await page.reload()
  await expect(board.getByText('No tasks', { exact: true })).toHaveCount(5)
})

test('cancels deletion and can retry a failed confirmation', async ({ page, workspace }) => {
  /** Keeps the draft and focus, and blocks dismissal while deletion is pending. */
  await workspace.open()
  await page.getByRole('button', { name: 'Edit Prepare report' }).click()
  const editor = page.getByRole('dialog', { name: 'Edit task' })
  await editor.getByLabel('Title', { exact: true }).fill('Unsaved draft')
  const deleteButton = editor.getByRole('button', { name: 'Delete', exact: true })
  await deleteButton.click()
  const confirmation = page.getByRole('alertdialog', { name: 'Delete task?' })
  await expect(confirmation.getByRole('button', { name: 'Cancel' })).toBeFocused()
  await expect(confirmation).toHaveAccessibleDescription(
    'Delete "Prepare report"? This cannot be undone.',
  )
  await confirmation.getByRole('button', { name: 'Cancel' }).click()
  await expect(confirmation).toHaveCount(0)
  await expect(deleteButton).toBeFocused()
  await expect(editor.getByLabel('Title', { exact: true })).toHaveValue('Unsaved draft')

  await deleteButton.click()
  await page.keyboard.press('Escape')
  await expect(confirmation).toHaveCount(0)
  await expect(deleteButton).toBeFocused()

  let releaseResponse = () => {}
  const responseReady = new Promise<void>((resolve) => {
    releaseResponse = resolve
  })
  await page.route('**/api/tasks/4/', async (route) => {
    await responseReady
    await route.fulfill({ status: 500 })
  })
  await deleteButton.click()
  await confirmation.getByRole('button', { name: 'Delete', exact: true }).click()
  try {
    await expect(confirmation.getByRole('button', { name: 'Deleting...' })).toBeDisabled()
    await expect(confirmation.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    await page.keyboard.press('Escape')
    await expect(confirmation.getByRole('heading', { name: 'Delete task?' })).toBeVisible()
  } finally {
    releaseResponse()
  }
  await expect(confirmation.getByRole('alert')).toContainText('Please try again.')
  await page.unroute('**/api/tasks/4/')
  await confirmation.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(confirmation).toHaveCount(0)
  await expect(editor).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Prepare report' })).toHaveCount(0)
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
  page.once('dialog', (question) => void question.accept())
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Edit Prepare report' }),
  ).toBeFocused()

  await page.getByRole('button', { name: 'New task', exact: true }).click()
  await expect(dialog.getByLabel('Title', { exact: true })).toHaveValue('')
  await expect(dialog.getByRole('alert')).toHaveCount(0)
})

test('saves a status change and keeps the saved status after a failure', async ({
  page,
  workspace,
}) => {
  /** Displays server state after successful and rejected writes. */
  await workspace.open()
  const status = page.getByLabel('Status for Prepare report')
  await chooseOption(page, status, 'Done')
  await expect(status).toBeEnabled()
  await expect(status).toHaveText('Done')
  await expect(
    page.getByRole('region', { name: 'Done', exact: true }).getByRole('heading', { level: 3 }),
  ).toHaveText('Prepare report')
  await page.reload()
  await expect(status).toHaveText('Done')
  await page.route('**/api/tasks/4/status/', (route) =>
    route.fulfill({ status: 500 }),
  )
  await chooseOption(page, status, 'Blocked')
  await expect(page.getByRole('alert')).toContainText('Please try again.')
  await expect(status).toHaveText('Done')
  await expect(
    page.getByRole('region', { name: 'Blocked', exact: true }).getByRole('heading', { level: 3 }),
  ).toHaveCount(0)
})

test('asks before closing a changed form', async ({ page, workspace }) => {
  /** Escape or Cancel must not lose typed text by mistake. */
  await workspace.open()
  await page.getByRole('button', { name: 'Edit Prepare report' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Title', { exact: true }).fill('Half-written title')
  page.once('dialog', (question) => void question.dismiss())
  await page.keyboard.press('Escape')
  await expect(dialog.getByLabel('Title', { exact: true })).toHaveValue('Half-written title')
  page.once('dialog', (question) => void question.accept())
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Prepare report' })).toBeVisible()
})
