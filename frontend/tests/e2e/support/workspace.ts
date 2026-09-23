import { test as base, expect, type Request } from '@playwright/test'
import { mockApi, type WorkspaceData } from './mock-api'

type Workspace = {
  open: (data?: WorkspaceData) => Promise<void>
  taskRequests: URL[]
  userRequests: URL[]
}

export const test = base.extend<{ workspace: Workspace }>({
  workspace: async ({ page }, use) => {
    const taskRequests: URL[] = []
    const userRequests: URL[] = []
    function recordFinishedRequest(request: Request): void {
      const url = new URL(request.url())
      if (request.method() !== 'GET') return
      if (url.pathname === '/api/tasks/') taskRequests.push(url)
      if (url.pathname === '/api/users/') userRequests.push(url)
    }
    page.on('requestfinished', recordFinishedRequest)
    let opened = false
    await use({
      taskRequests,
      userRequests,
      async open(data) {
        if (opened)
          throw new Error(
            'Open the workspace once per test. Use page.reload() to check saved changes.',
          )
        opened = true
        await mockApi(page, data)
        await page.goto('/')
        await expect(page.getByRole('heading', { name: 'Tasks' })).toBeVisible()
        await expect(
          page.getByText('Loading tasks...', { exact: true }),
        ).toHaveCount(0)
      },
    })
    page.off('requestfinished', recordFinishedRequest)
  },
})

export { expect } from '@playwright/test'
