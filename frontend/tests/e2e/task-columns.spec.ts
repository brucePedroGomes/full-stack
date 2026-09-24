import { chooseOption } from './support/select'
import { mockApi } from './support/mock-api'
import { makeTask, makeTasks } from '../support/fixtures'
import { expect, test } from './support/workspace'

test('loads more cards in one column', async ({ page, workspace }) => {
  /** "Show more" asks only this column for its next page. */
  await workspace.open({ tasks: makeTasks(21) })
  const planned = page.getByRole('region', { name: 'Planned', exact: true })
  const titles = planned.getByRole('heading', { level: 3 })
  await expect(titles).toHaveCount(20)
  await expect(titles.first()).toHaveText('Task 21')
  await planned.getByRole('button', { name: 'Show more' }).click()
  await expect(titles).toHaveCount(21)
  await expect(titles.last()).toHaveText('Task 1')
  await expect(planned.getByRole('button', { name: 'Show more' })).toHaveCount(0)
  const lastRequest = workspace.taskRequests.at(-1)
  expect(lastRequest?.searchParams.get('page')).toBe('2')
  expect(lastRequest?.searchParams.get('status')).toBe('planned')
})

test('shows an error in one column and can retry it', async ({ page, workspace }) => {
  /** A failed column does not hide the other columns. */
  await workspace.open({ tasks: [makeTask({ title: 'Finished task', status: 'done' })] })
  const doneColumn = (url: URL) =>
    url.pathname === '/api/tasks/' && url.searchParams.get('status') === 'done'
  await page.route(doneColumn, (route) =>
    route.fulfill({ status: 400, json: { detail: 'Column temporarily unavailable.' } }),
  )
  await page.reload()
  const done = page.getByRole('region', { name: 'Done', exact: true })
  await expect(done.getByRole('alert')).toContainText('Column temporarily unavailable.')
  await expect(
    page.getByRole('region', { name: 'Planned', exact: true }).getByText('No tasks', { exact: true }),
  ).toBeVisible()
  await page.unroute(doneColumn)
  await done.getByRole('button', { name: 'Retry' }).click()
  await expect(done.getByRole('heading', { name: 'Finished task' })).toBeVisible()
})

test('keeps the loaded cards after editing one', async ({ page, workspace }) => {
  /** Saving does not send the user back to the start of the board. */
  await workspace.open({ tasks: makeTasks(21) })
  const planned = page.getByRole('region', { name: 'Planned', exact: true })
  await planned.getByRole('button', { name: 'Show more' }).click()
  const titles = planned.getByRole('heading', { level: 3 })
  await expect(titles).toHaveCount(21)
  await page.getByRole('button', { name: 'Edit Task 1', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Title', { exact: true }).fill('Task 1 edited')
  await dialog.getByRole('button', { name: 'Save task' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(titles).toHaveCount(21)
  await expect(titles.first()).toHaveText('Task 1 edited')
})

test('waits for a column reload before loading more', async ({ page, workspace }) => {
  /** "Show more" never adds a new page to old cards. */
  await workspace.open({
    tasks: [...makeTasks(21), makeTask({ id: 100, title: 'Mover', status: 'done' })],
  })
  const planned = page.getByRole('region', { name: 'Planned', exact: true })
  let releaseReload = () => {}
  const reloadReady = new Promise<void>((resolve) => {
    releaseReload = resolve
  })
  const plannedColumn = (url: URL) =>
    url.pathname === '/api/tasks/' && url.searchParams.get('status') === 'planned'
  await page.route(plannedColumn, async (route) => {
    await reloadReady
    await route.fallback()
  })
  await chooseOption(page, page.getByLabel('Status for Mover'), 'Planned')
  try {
    await expect(planned.getByRole('button', { name: 'Show more' })).toBeDisabled()
  } finally {
    releaseReload()
  }
  await expect(planned.getByRole('button', { name: 'Show more' })).toBeEnabled()
})

test('never shows a card twice when tasks change between pages', async ({ page, workspace }) => {
  /** A teammate edits a task while this user loads more cards. */
  await workspace.open({ tasks: makeTasks(21) })
  const planned = page.getByRole('region', { name: 'Planned', exact: true })
  const titles = planned.getByRole('heading', { level: 3 })
  await expect(titles).toHaveCount(20)
  await page.evaluate(() =>
    fetch('/api/tasks/1/', {
      method: 'PATCH',
      headers: { Authorization: 'Bearer test-access', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Task 1',
        description: 'Edited by a teammate',
        due_date: null,
        assigned_to: null,
      }),
    }).then((response) => response.status),
  )
  await planned.getByRole('button', { name: 'Show more' }).click()
  await expect(planned.getByRole('button', { name: 'Show more' })).toHaveCount(0)
  const shown = await titles.allInnerTexts()
  expect(shown.length).toBe(new Set(shown).size)
})

test('shows a count only after the server answers', async ({ page }) => {
  /** A column never claims "0 tasks" while it is still loading. */
  await mockApi(page, { tasks: [makeTask({ title: 'Finished task', status: 'done' })] })
  let releaseColumn = () => {}
  const columnReady = new Promise<void>((resolve) => {
    releaseColumn = resolve
  })
  await page.route(
    (url) => url.pathname === '/api/tasks/' && url.searchParams.get('status') === 'done',
    async (route) => {
      await columnReady
      await route.fallback()
    },
  )
  await page.goto('/')
  const done = page.getByRole('region', { name: 'Done', exact: true })
  try {
    await expect(done.getByText('Loading tasks...')).toBeVisible()
    await expect(done).not.toContainText('0 tasks')
  } finally {
    releaseColumn()
  }
  await expect(done).toContainText('1 tasks')
})
