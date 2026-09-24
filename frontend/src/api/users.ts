import { queryOptions } from '@tanstack/react-query'
import { USER_PAGE_SIZE } from '@/config'
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
    queryKey: ['users'],
    queryFn: ({ signal }) => getUsers(session, signal),
    staleTime: 60_000,
    retry: false,
  })
}

export async function getUsers(
  session: Session,
  signal?: AbortSignal,
): Promise<UserSummary[]> {
  const data = await requestWithSession<UserPage>(
    `/api/users/?page=1&page_size=${USER_PAGE_SIZE}`,
    session,
    { signal },
  )
  return data.results
}
