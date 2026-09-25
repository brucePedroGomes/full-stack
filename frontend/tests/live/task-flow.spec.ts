import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { chooseOption } from '../e2e/support/select'

test('saves a task through Django and keeps changes after reload', async ({ page }) => {
  const title = `Live review ${randomUUID()}`
  const editedTitle = `${title} edited`
  const problems: string[] = []
  page.on('pageerror', (error) => problems.push(error.message))
  page.on('console', (message) => {
    // A fresh browser receives an expected 401 while restoring its session.
    const expectedAnonymousSession = message.location().url.endsWith('/api/auth/browser/token/')
      && message.text().includes('401')
    if (['warning', 'error'].includes(message.type()) && !expectedAnonymousSession) {
      problems.push(message.text())
    }
  })

  await page.goto('/')
  await page.getByLabel('Username').fill('bruce-gomes')
  await page.getByLabel('Password').fill('Tempo-demo-2026!')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Tasks', exact: true })).toBeVisible()

  const renewal = await page.request.post('/api/auth/browser/token/', {
    headers: {
      'X-CSRFToken': (await page.context().cookies()).find((cookie) => cookie.name === 'csrftoken')!.value,
    },
  })
  expect(renewal.ok()).toBe(true)
  const { access } = await renewal.json() as { access: string }
  const headers = { Authorization: `Bearer ${access}` }
  let taskId: number | undefined

  try {
    await page.getByRole('button', { name: 'New task', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Title', { exact: true }).fill(title)
    await dialog.getByLabel('Description').fill('Created by the real browser test.')
    await dialog.getByLabel('Due date', { exact: true }).fill('2020-01-01')
    await chooseOption(page, dialog.getByLabel('Assigned to'), 'Bruno Costa')
    const created = page.waitForResponse((response) =>
      new URL(response.url()).pathname === '/api/tasks/' && response.request().method() === 'POST',
    )
    await dialog.getByRole('button', { name: 'Save task' }).click()
    const response = await created
    expect(response.status()).toBe(201)
    taskId = (await response.json() as { id: number }).id
    await expect(dialog).toHaveCount(0)

    await page.reload()
    await page.getByLabel('Search tasks').fill(title)
    const card = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: title, exact: true }) })
    await expect(card).toContainText('Bruno Costa')
    await expect(card).toContainText('Overdue')
    await chooseOption(page, page.getByLabel('Filter by due date'), 'Overdue')
    await expect(card).toBeVisible()

    await page.getByRole('button', { name: `Edit ${title}`, exact: true }).click()
    await dialog.getByLabel('Title', { exact: true }).fill(editedTitle)
    await dialog.getByRole('button', { name: 'Save task' }).click()
    await expect(dialog).toHaveCount(0)
    await chooseOption(page, page.getByLabel(`Status for ${editedTitle}`, { exact: true }), 'Done')
    await expect(page.getByRole('heading', { name: editedTitle, exact: true })).toHaveCount(0)

    await page.reload()
    await page.getByLabel('Search tasks').fill(title)
    const done = page.getByRole('region', { name: 'Done', exact: true })
    await expect(done.getByRole('heading', { name: editedTitle, exact: true })).toBeVisible()
    const saved = await page.request.get(`/api/tasks/${taskId}/`, { headers })
    expect(saved.ok()).toBe(true)
    expect(await saved.json()).toMatchObject({ title: editedTitle, status: 'done', is_overdue: false })

    await page.getByRole('button', { name: `Edit ${editedTitle}`, exact: true }).click()
    await dialog.getByRole('button', { name: 'Delete', exact: true }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete', exact: true }).click()
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
    await expect(dialog).toHaveCount(0)
    const deleted = await page.request.get(`/api/tasks/${taskId}/`, { headers })
    expect(deleted.status()).toBe(404)
    taskId = undefined

    await page.getByRole('button', { name: 'Sign out', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible()
    expect(problems).toEqual([])
  } finally {
    // Remove only the record created by this run, including after a failed assertion.
    if (taskId !== undefined) {
      const cleanup = await page.request.delete(`/api/tasks/${taskId}/`, { headers })
      expect([204, 404]).toContain(cleanup.status())
    }
  }
})
