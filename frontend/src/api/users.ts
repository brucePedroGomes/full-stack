import { queryOptions } from '@tanstack/react-query'
import { PAGE_SIZE } from '@/config'
import { requestWithSession, type Session } from './session'

export type UserSummary = {
  id: number
  username: string
  first_name: string
  last_name: string
}
type UserPage = { count: number; next: string | null; results: UserSummary[] }

export function getUserName(user: UserSummary): string {
  return `${user.first_name} ${user.last_name}`.trim() || user.username
}

export function usersQuery(session: Session) {
  return queryOptions({
    queryKey: ['users', 'all'],
    queryFn: ({ signal }) => getAllUsers(session, signal),
    staleTime: 60_000,
    retry: false,
  })
}

export async function getAllUsers(
  session: Session,
  signal?: AbortSignal,
): Promise<UserSummary[]> {
  const users: UserSummary[] = []
  let page = 1
  while (true) {
    const data = await getUsers(session, '', page, signal)
    users.push(...data.results)
    if (!data.next) return users
    page += 1
  }
}

export async function getUsers(
  session: Session,
  search: string,
  page = 1,
  signal?: AbortSignal,
): Promise<UserPage> {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(PAGE_SIZE),
  })
  if (search) params.set('search', search)
  return requestWithSession<UserPage>(`/api/users/?${params}`, session, {
    signal,
  })
}
