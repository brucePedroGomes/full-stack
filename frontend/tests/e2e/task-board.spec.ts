import { chooseOption } from './support/select'
import { taskStatuses } from '@/api/tasks'
import { makeTask } from '../support/fixtures'
import { expect, test } from './support/workspace'

test('shows every column with its real count and moves a saved card', async ({
  page,
  workspace,
}, testInfo) => {
  /** Each column loads its own tasks, so a count is not limited to one page. */
  await workspace.open({
    tasks: [
      ...Array.from({ length: 24 }, (_, index) =>
        makeTask({ id: index + 1, title: `Old blocked task ${index + 1}`, status: 'blocked' }),
      ),
      ...taskStatuses.map((status, index) =>
        makeTask({ id: 101 + index, title: `${status.label} task`, status: status.value }),
      ),
    ],
  })
  const board = page.getByRole('region', { name: 'Task board' })
  await expect(board.getByRole('heading', { level: 2 })).toHaveText(
    taskStatuses.map((status) => status.label),
  )
  for (const status of taskStatuses) {
    const column = board.getByRole('region', { name: status.label, exact: true })
    await expect(
      column.getByRole('heading', { name: `${status.label} task`, exact: true }),
    ).toBeVisible()
  }
  const blocked = board.getByRole('region', { name: 'Blocked', exact: true })
  await expect(blocked).toContainText('25 tasks')
  await expect(blocked.getByRole('heading', { level: 3 })).toHaveCount(20)
  expect(
    new Set(workspace.taskRequests.map((url) => url.searchParams.get('status'))),
  ).toEqual(new Set(taskStatuses.map((status) => status.value)))
  await page.screenshot({ path: testInfo.outputPath('desktop-board.png'), fullPage: true })

  await chooseOption(page, page.getByLabel('Status for Planned task'), 'In progress')
  const planned = board.getByRole('region', { name: 'Planned', exact: true })
  const inProgress = board.getByRole('region', { name: 'In progress', exact: true })
  await expect(planned.getByText('No tasks', { exact: true })).toBeVisible()
  await expect(inProgress.getByRole('heading', { level: 3 })).toHaveText([
    'Planned task',
    'In progress task',
  ])
})

test('keeps every column when a search finds nothing', async ({ page, workspace }) => {
  /** Shows each empty column instead of hiding the board. */
  await workspace.open()
  const board = page.getByRole('region', { name: 'Task board' })
  await page.getByLabel('Search tasks').fill('No matching task')
  await expect(board.getByRole('heading', { level: 3 })).toHaveCount(0)
  await expect(board.getByRole('heading', { level: 2 })).toHaveCount(5)
  await expect(board.getByText('No tasks', { exact: true })).toHaveCount(5)
})

test('shows a move only after the server saves it', async ({ page, workspace }) => {
  /** Nothing moves on screen before the server confirms it, and other cards stay usable. */
  await workspace.open({
    tasks: [makeTask({ id: 1, title: 'First card' }), makeTask({ id: 2, title: 'Second card' })],
  })
  let releaseMove = () => {}
  const moveReady = new Promise<void>((resolve) => {
    releaseMove = resolve
  })
  await page.route('**/api/tasks/1/status/', async (route) => {
    await moveReady
    await route.fallback()
  })
  await chooseOption(page, page.getByLabel('Status for First card'), 'Done')
  const board = page.getByRole('region', { name: 'Task board' })
  const planned = board.getByRole('region', { name: 'Planned', exact: true })
  const done = board.getByRole('region', { name: 'Done', exact: true })
  try {
    await expect(planned.getByRole('heading', { name: 'First card' })).toBeVisible()
    await expect(done.getByRole('heading', { name: 'First card' })).toHaveCount(0)
    await expect(page.getByLabel('Status for First card')).toBeDisabled()
    await expect(planned.getByText('Moving...')).toBeVisible()
    await expect(page.getByLabel('Status for Second card')).toBeEnabled()
  } finally {
    releaseMove()
  }
  await expect(done.getByRole('heading', { name: 'First card' })).toBeVisible()
  await expect(planned.getByRole('heading', { name: 'First card' })).toHaveCount(0)
  await expect(page.getByText('Moved "First card" to Done.')).toBeVisible()
})

test('moves two cards at the same time', async ({ page, workspace }) => {
  /** Review focus: two quick moves both end in the right column. */
  await workspace.open({
    tasks: [makeTask({ id: 1, title: 'First card' }), makeTask({ id: 2, title: 'Second card' })],
  })
  let releaseMoves = () => {}
  const movesReady = new Promise<void>((resolve) => {
    releaseMoves = resolve
  })
  await page.route('**/api/tasks/*/status/', async (route) => {
    await movesReady
    await route.fallback()
  })
  await chooseOption(page, page.getByLabel('Status for First card'), 'Done')
  await chooseOption(page, page.getByLabel('Status for Second card'), 'Blocked')
  const board = page.getByRole('region', { name: 'Task board' })
  const done = board.getByRole('region', { name: 'Done', exact: true })
  const blocked = board.getByRole('region', { name: 'Blocked', exact: true })
  releaseMoves()
  await expect(page.getByLabel('Status for First card')).toHaveText('Done')
  await expect(page.getByLabel('Status for Second card')).toHaveText('Blocked')
  await page.reload()
  await expect(done.getByRole('heading', { name: 'First card' })).toBeVisible()
  await expect(blocked.getByRole('heading', { name: 'Second card' })).toBeVisible()
})

test('drags a card to another column', async ({ page, workspace }) => {
  /** Mouse users drag cards like in Trello. The change is saved. */
  await workspace.open({ tasks: [makeTask({ title: 'Drag me' })] })
  const board = page.getByRole('region', { name: 'Task board' })
  const done = board.getByRole('region', { name: 'Done', exact: true })
  await board.getByRole('listitem').filter({ hasText: 'Drag me' }).dragTo(done)
  await expect(done.getByRole('heading', { name: 'Drag me' })).toBeVisible()
  await expect(page.getByLabel('Status for Drag me')).toHaveText('Done')
  await page.reload()
  await expect(done.getByRole('heading', { name: 'Drag me' })).toBeVisible()
})

test('ignores drops that are not a move', async ({ page, workspace }) => {
  /** Review focus: a drop on the same column, or plain text, sends nothing. */
  await workspace.open({ tasks: [makeTask({ title: 'Stay here' })] })
  const writes: string[] = []
  page.on('request', (request) => {
    if (request.method() === 'PATCH') writes.push(request.url())
  })
  const board = page.getByRole('region', { name: 'Task board' })
  const planned = board.getByRole('region', { name: 'Planned', exact: true })
  await board
    .getByRole('listitem')
    .filter({ hasText: 'Stay here' })
    .dragTo(planned, { targetPosition: { x: 20, y: 10 } })
  const text = await page.evaluateHandle(() => {
    const data = new DataTransfer()
    data.setData('text/plain', 'Just some text')
    return data
  })
  await board
    .getByRole('region', { name: 'Done', exact: true })
    .dispatchEvent('drop', { dataTransfer: text })
  await expect(planned.getByRole('heading', { name: 'Stay here' })).toBeVisible()
  expect(writes).toEqual([])
})

test('marks late tasks as overdue', async ({ page, workspace }) => {
  /** The backend decides what is late. The card shows it with a word, not only a color. */
  await workspace.open({
    tasks: [
      makeTask({ id: 1, title: 'Late report', is_overdue: true }),
      makeTask({ id: 2, title: 'On time report' }),
    ],
  })
  const cards = page.getByRole('region', { name: 'Task board' }).getByRole('listitem')
  await expect(cards.filter({ hasText: 'Late report' })).toContainText('Overdue')
  await expect(cards.filter({ hasText: 'On time report' })).not.toContainText('Overdue')
})
