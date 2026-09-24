import { createContext, useContext, type ReactNode } from 'react'
import type { SignedInSession } from '@/api/session'
import { useTasks } from '@/hooks/useTasks'

type TaskProviderProps = SignedInSession & {
  onSessionExpired: (message: string) => void
  children: ReactNode
}

const TaskContext = createContext<ReturnType<typeof useTasks> | null>(null)

export function TaskProvider({ children, ...session }: TaskProviderProps) {
  const tasks = useTasks(session)
  return <TaskContext.Provider value={tasks}>{children}</TaskContext.Provider>
}

export function useTaskContext() {
  const context = useContext(TaskContext)
  if (!context) throw new Error('useTaskContext must be used inside TaskProvider.')
  return context
}
