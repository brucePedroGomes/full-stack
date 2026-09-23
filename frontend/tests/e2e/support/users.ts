import type { Route } from '@playwright/test'
import type { UserSummary } from '@/api/users'
import { paginate } from './pagination'

export async function handleUsers(
  route: Route,
  users: UserSummary[],
): Promise<void> {
  if (route.request().method() !== 'GET') {
    await route.fulfill({ status: 405 })
    return
  }
  const url = new URL(route.request().url())
  const terms = (url.searchParams.get('search') ?? '')
    .toLowerCase()
    .split(/\s+/)
  const matches = users
    .filter((user) => {
      const name =
        `${user.first_name} ${user.last_name} ${user.username}`.toLowerCase()
      return terms.every((term) => name.includes(term))
    })
    .toSorted((a, b) => a.username.localeCompare(b.username))
  await route.fulfill({ json: paginate(matches, url, 20) })
}
