import { useQuery } from '@tanstack/react-query'
import type { Session } from '@/api/session'
import { usersQuery } from '@/api/users'

export function useUsers(session: Session) {
  return useQuery(usersQuery(session))
}
