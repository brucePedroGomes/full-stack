import { PAGE_SIZE } from '@/config'
import { makeTasks } from '../support/fixtures'
import { expect, test } from './support/workspace'

test('requests one page at a time and displays the server order', async ({
  page,
  workspace,
}) => {
  /** Loads more tasks only when the user changes the page. */
  await workspace.open({ tasks: makeTasks(PAGE_SIZE + 1) })
  const pages = page.getByRole('navigation', { name: 'Task pages' })
  const titles = page.getByRole('region', { name: 'Task board' }).getByRole('heading', { level: 3 })
  await expect(titles).toHaveCount(PAGE_SIZE)
  await expect(titles.first()).toHaveText(`Task ${PAGE_SIZE + 1}`)
  expect(workspace.taskRequests).toHaveLength(1)
  expect(workspace.taskRequests[0].searchParams.get('ordering')).toBe('-id')
  await expect(pages.getByRole('button', { name: 'Previous' })).toBeDisabled()
  await pages.getByRole('button', { name: 'Next' }).click()
  await expect(titles).toHaveText(['Task 1'])
  await expect(pages).toContainText('Page 2')
  await expect(pages.getByRole('button', { name: 'Next' })).toBeDisabled()
  expect(workspace.taskRequests.at(-1)?.searchParams.get('page')).toBe('2')
  await pages.getByRole('button', { name: 'Previous' }).click()
  await expect(titles).toHaveCount(PAGE_SIZE)
})

test('can retry a failed page', async ({ page, workspace }) => {
  /** Keeps page navigation available after a network error. */
  await workspace.open({ tasks: makeTasks(PAGE_SIZE + 1) })
  const secondPage = (url: URL) =>
    url.pathname === '/api/tasks/' && url.searchParams.get('page') === '2'
  await page.route(secondPage, (route) =>
    route.fulfill({
      status: 400,
      json: { detail: 'Page temporarily unavailable.' },
    }),
  )
  await page
    .getByRole('navigation', { name: 'Task pages' })
    .getByRole('button', { name: 'Next' })
    .click()
  await expect(page.getByRole('alert')).toContainText(
    'Page temporarily unavailable.',
  )
  await page.unroute(secondPage)
  await page.getByRole('button', { name: 'Retry tasks' }).click()
  await expect(
    page.getByRole('heading', { name: 'Task 1', exact: true }),
  ).toBeVisible()
})

test('returns to page one after deleting the last task on a page', async ({
  page,
  workspace,
}) => {
  /** Avoids leaving the user on an empty final page. */
  await workspace.open({ tasks: makeTasks(PAGE_SIZE + 1) })
  const pages = page.getByRole('navigation', { name: 'Task pages' })
  await pages.getByRole('button', { name: 'Next' }).click()
  await page.getByRole('button', { name: 'Edit Task 1', exact: true }).click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Delete', exact: true })
    .click()
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Delete', exact: true })
    .click()
  await expect(pages).toContainText('Page 1')
  await expect(
    page.getByRole('region', { name: 'Task board' }).getByRole('heading', { level: 3 }),
  ).toHaveCount(PAGE_SIZE)
})
