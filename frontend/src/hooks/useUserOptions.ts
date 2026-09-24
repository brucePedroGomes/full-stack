import { useCallback, useEffect } from 'react'
import { SessionExpiredError, type Session } from '@/api/session'
import { getUserName, type UserSummary } from '@/api/users'
import { useUsers } from './useUsers'

const emptyUsers: UserSummary[] = []

export function useUserOptions(
  session: Session,
  onSessionExpired: (message: string) => void,
  selectedUser?: UserSummary | null,
) {
  const { data, error, isPending, refetch } = useUsers(session)
  const users = data ?? emptyUsers
  const options = users.map((user) => ({ value: user.id, label: getUserName(user) }))
  if (selectedUser && !users.some((user) => user.id === selectedUser.id)) {
    options.unshift({ value: selectedUser.id, label: getUserName(selectedUser) })
  }

  useEffect(() => {
    if (error instanceof SessionExpiredError) onSessionExpired(error.message)
  }, [error, onSessionExpired])

  const handleRetry = useCallback(() => {
    void refetch()
  }, [refetch])

  return { options, error, isPending, retry: handleRetry }
}
