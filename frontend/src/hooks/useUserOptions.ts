import { getUserName, type UserSummary } from '@/api/users'
import { useTaskContext } from '@/contexts/TaskContext'

const emptyUsers: UserSummary[] = []

export function useUserOptions(selectedUser?: UserSummary | null) {
  const { users: query } = useTaskContext()
  const { data, error, isPending } = query
  const users = data ?? emptyUsers

  const options = users.map((user) => ({ value: user.id, label: getUserName(user) }))
  if (selectedUser && !users.some((user) => user.id === selectedUser.id)) {
    options.unshift({ value: selectedUser.id, label: getUserName(selectedUser) })
  }

  function retry() {
    void query.refetch()
  }

  return { options, error, isPending, retry }
}
