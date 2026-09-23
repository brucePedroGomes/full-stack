import { taskStatuses } from '@/api/tasks'
import { makeTask } from '../support/fixtures'
import { expect, test } from './support/workspace'

test('fits a narrow screen and scrolls the dialog to its actions', async ({
  page,
  workspace,
}, testInfo) => {
  /** Checks layout and real scrolling at a small viewport. */
  await page.setViewportSize({ width: 375, height: 667 })
  await workspace.open({
    tasks: taskStatuses.map((status, index) =>
      makeTask({ id: index + 1, status: status.value, title: 'A'.repeat(200) }),
    ),
  })
  for (const width of [320, 768, 375]) {
    await page.setViewportSize({ width, height: 667 })
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
  }
  await page.screenshot({
    path: testInfo.outputPath('mobile-board.png'),
    fullPage: true,
  })
  await page.getByRole('button', { name: 'New task', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Title', { exact: true }).fill('Mobile task')
  await dialog
    .getByRole('button', { name: 'Save task' })
    .scrollIntoViewIfNeeded()
  await expect(
    dialog.getByRole('button', { name: 'Save task' }),
  ).toBeInViewport()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('mobile-form.png') })
  await dialog.getByRole('button', { name: 'Save task' }).click()
  await expect(page.getByRole('heading', { name: 'Mobile task' })).toBeVisible()
})

test('keeps keyboard focus inside the dialog', async ({ page, workspace }) => {
  /** Uses Headless UI focus handling and restores the opener. */
  await workspace.open()
  const opener = page.getByRole('button', { name: 'New task', exact: true })
  await opener.click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Save task' }).focus()
  await page.keyboard.press('Tab')
  await expect(dialog.getByLabel('Title', { exact: true })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(opener).toBeFocused()
})
