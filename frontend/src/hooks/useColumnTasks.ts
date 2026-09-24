import { useEffect } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { SessionExpiredError } from '@/api/session'
import type { Task, TaskStatus } from '@/api/tasks'
import { useTaskContext } from '@/contexts/TaskContext'

function withoutDuplicates(tasks: Task[]) {
  return tasks.filter((task, index) => tasks.findIndex((other) => other.id === task.id) === index)
}

export function useColumnTasks(status: TaskStatus) {
  const { columnTasks, onSessionExpired } = useTaskContext()
  const query = useInfiniteQuery(columnTasks(status))
  const tasks = withoutDuplicates(query.data?.pages.flatMap((page) => page.results) ?? [])

  useEffect(() => {
    if (query.error instanceof SessionExpiredError)
      onSessionExpired(query.error.message)
  }, [query.error, onSessionExpired])

  return {
    tasks,
    count: query.data?.pages[0]?.count,
    isLoading: query.isPending,
    isEmpty: query.isSuccess && tasks.length === 0,
    isUpdating: query.isFetching,
    isShowingOldResults: query.isPlaceholderData,
    error: query.error,
    retry: () => void query.refetch(),
    hasMore: query.hasNextPage,
    isLoadingMore: query.isFetchingNextPage,
    showMore: () => void query.fetchNextPage(),
  }
}
