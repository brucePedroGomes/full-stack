import { chooseOption } from './support/select'
import { expect, test } from './support/workspace'

test('adds cards to a column with the keyboard', async ({ page, workspace }) => {
  /** Type a title, press Enter, and type the next one, like in Trello. */
  await workspace.open({ tasks: [] })
  const writes: string[] = []
  page.on('request', (request) => {
    if (request.method() !== 'GET')
      writes.push(`${request.method()} ${new URL(request.url()).pathname}`)
  })
  const todo = page.getByRole('region', { name: 'To do', exact: true })
  await todo.getByRole('button', { name: 'Add a card', exact: true }).click()
  const title = todo.getByLabel('Title for a new To do card')
  await expect(title).toBeFocused()
  await title.fill('First card')
  await title.press('Enter')
  await expect(todo.getByRole('heading', { name: 'First card' })).toBeVisible()
  await expect(title).toHaveValue('')
  await expect(title).toBeFocused()
  await title.fill('Second card')
  await title.press('Enter')
  await expect(todo.getByRole('heading', { level: 3 })).toHaveText(['Second card', 'First card'])
  expect(writes).toEqual(['POST /api/tasks/', 'POST /api/tasks/'])
  await title.press('Escape')
  await expect(title).toHaveCount(0)
  await page.reload()
  await expect(todo.getByRole('heading', { level: 3 })).toHaveText(['Second card', 'First card'])
})

test('does not send an empty title', async ({ page, workspace }) => {
  /** Review focus: spaces only means no new card. */
  await workspace.open({ tasks: [] })
  let writes = 0
  page.on('request', (request) => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/tasks/')
      writes += 1
  })
  const planned = page.getByRole('region', { name: 'Planned', exact: true })
  await planned.getByRole('button', { name: 'Add a card', exact: true }).click()
  const title = planned.getByLabel('Title for a new Planned card')
  await title.fill('   ')
  await title.press('Enter')
  await planned.getByRole('button', { name: 'Add card', exact: true }).click()
  await expect(planned.getByText('No tasks', { exact: true })).toBeVisible()
  expect(writes).toBe(0)
})

test('confirms a new card even when a filter hides it', async ({ page, workspace }) => {
  /** The user knows the card was added, so they do not add it twice. */
  await workspace.open({ tasks: [] })
  await chooseOption(page, page.getByLabel('Filter by due date'), 'Overdue')
  const todo = page.getByRole('region', { name: 'To do', exact: true })
  await todo.getByRole('button', { name: 'Add a card', exact: true }).click()
  const title = todo.getByLabel('Title for a new To do card')
  await title.fill('Hidden card')
  await title.press('Enter')
  await expect(page.getByRole('status').filter({ hasText: 'Added' })).toHaveText('Added "Hidden card".')
  await expect(todo.getByRole('heading', { name: 'Hidden card' })).toHaveCount(0)
})
