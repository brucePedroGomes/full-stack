import { expect, type Page } from '@playwright/test'
import type { Task } from '@/api/tasks'
import type { UserSummary } from '@/api/users'
import {
  makeSignedInSession,
  makeTask,
  makeUsers,
} from '../../support/fixtures'
import { createTaskHandler } from './tasks'
import { handleUsers } from './users'

export type WorkspaceData = { tasks?: Task[]; users?: UserSummary[] }

export async function mockApi(
  page: Page,
  data: WorkspaceData = {},
): Promise<void> {
  const users = structuredClone(data.users ?? makeUsers())
  const handleTasks = createTaskHandler(data.tasks ?? [makeTask()], users)
  const { account, session } = makeSignedInSession()

  await page.route(
    (url) => url.pathname.startsWith('/api/'),
    async (route) => {
      const request = route.request()
      const path = new URL(request.url()).pathname
      switch (path) {
        case '/api/auth/browser/csrf/':
          await route.fulfill({
            status: 204,
            headers: { 'Set-Cookie': 'csrftoken=test-csrf; Path=/' },
          })
          return
        case '/api/auth/browser/token/':
        case '/api/auth/browser/login/':
          await route.fulfill({ json: session })
          return
        case '/api/auth/browser/logout/':
          await route.fulfill({ status: 204 })
          return
        case '/api/users/me/':
          await route.fulfill({ json: account })
          return
      }

      expect(request.headers().authorization).toBe(`Bearer ${session.access}`)
      if (path === '/api/users/') return handleUsers(route, users)
      if (/^\/api\/tasks\/(\d+\/(status\/)?)?$/.test(path))
        return handleTasks(route)
      throw new Error(`Unexpected API request: ${request.method()} ${path}`)
    },
  )
}
