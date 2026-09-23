import { ArrowUpRight, ListTodo, LogOut, RefreshCw } from 'lucide-react'
import type { ReactElement } from 'react'
import { Brand } from '@/components/brand'
import { Button } from '@/components/ui/button'
import type { Account, TaskPage } from '@/lib/api'
import { cn } from '@/lib/utils'

type HomePageProps = {
  account: Account
  tasks: TaskPage | null
  taskError: string
  isLoading: boolean
  isRefreshing: boolean
  onRefresh: () => void
  onSignOut: () => void
}

const statusLabels: Record<string, string> = {
  planned: 'Planned',
  to_do: 'To do',
  in_progress: 'In progress',
  blocked: 'Blocked',
  done: 'Done',
}

const statusColors: Record<string, string> = {
  planned: 'bg-[#f7e6cb] text-[#77512d]',
  to_do: 'bg-[#e6e8ef] text-[#4d5875]',
  in_progress: 'bg-[#dbe9f3] text-[#2d5873]',
  blocked: 'bg-[#f8e1df] text-[#8a433b]',
  done: 'bg-[#e0eddd] text-[#3b6944]',
}

const dueDateFormatter = new Intl.DateTimeFormat('en', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
})

function formatDueDate(value: string | null): string {
  if (!value) return 'No due date'
  return `Due ${dueDateFormatter.format(new Date(`${value}T00:00:00Z`))}`
}

function TaskContent({
  tasks,
  taskError,
  isLoading,
}: Pick<HomePageProps, 'tasks' | 'taskError' | 'isLoading'>): ReactElement | null {
  if (isLoading) {
    return (
      <div className="space-y-4 px-6 py-8 sm:px-8" aria-label="Loading tasks">
        <div className="h-16 rounded-xl bg-[#f1f3ef] motion-safe:animate-pulse" />
        <div className="h-16 rounded-xl bg-[#f1f3ef] motion-safe:animate-pulse" />
        <div className="h-16 rounded-xl bg-[#f1f3ef] motion-safe:animate-pulse" />
      </div>
    )
  }

  if (tasks?.results.length) {
    return (
      <ul className="divide-y divide-[#edf0eb] px-6 sm:px-8">
        {tasks.results.map((task) => (
          <li key={task.id} className="flex flex-wrap items-center gap-4 py-5 sm:flex-nowrap">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#eef2ed] text-[#557d70]" aria-hidden="true">
              <ListTodo className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-[#17333b]">{task.title}</p>
              <p className="mt-1 text-sm text-[#74817c]">{formatDueDate(task.due_date)}</p>
            </div>
            <span className={cn('rounded-full px-3 py-1.5 text-xs font-medium', statusColors[task.status] ?? 'bg-[#eef2ed] text-[#315a4a]')}>
              {statusLabels[task.status] ?? task.status}
            </span>
          </li>
        ))}
      </ul>
    )
  }

  if (taskError) return null

  return (
    <div className="px-6 py-14 text-center sm:px-8">
      <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#eef2ed] text-[#557d70]">
        <ListTodo className="size-6" aria-hidden="true" />
      </div>
      <h3 className="mt-5 font-heading text-xl font-semibold">No tasks yet</h3>
      <p className="mt-2 text-sm text-[#65736f]">Tasks will appear here when your team adds them.</p>
    </div>
  )
}

export function HomePage({
  account,
  tasks,
  taskError,
  isLoading,
  isRefreshing,
  onRefresh,
  onSignOut,
}: HomePageProps): ReactElement {
  return (
    <div className="min-h-svh bg-[#f7f6f2] text-[#17333b]">
      <header className="border-b border-[#e1e5de] bg-white/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-5 sm:px-10">
          <Brand />
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-[#65736f] sm:inline">Signed in as {account.username}</span>
            <Button
              type="button"
              variant="outline"
              onClick={onSignOut}
              className="min-h-11 rounded-xl border-[#d9ded9] bg-white px-4 text-[#17333b] hover:bg-[#edf2ed]"
            >
              <LogOut className="size-4" aria-hidden="true" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-6 py-10 sm:px-10 sm:py-14">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(260px,0.8fr)]">
          <section className="relative overflow-hidden rounded-3xl bg-[#17333b] p-8 text-white sm:p-10">
            <div className="pointer-events-none absolute -right-28 -top-32 size-80 rounded-full border border-white/10" />
            <p className="relative text-xs font-semibold uppercase tracking-[0.2em] text-[#b7d0c6]">Your workspace</p>
            <h1 className="relative mt-5 max-w-lg font-heading text-4xl leading-tight tracking-tight sm:text-5xl">
              Welcome back, {account.username}.
            </h1>
            <p className="relative mt-5 max-w-md text-base leading-7 text-[#c5d6d3]">
              A clear view of your team&apos;s work starts here.
            </p>
            <div className="relative mt-10 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-[#e7f0eb]">
              <span className="size-2 rounded-full bg-[#a9d6a9]" aria-hidden="true" />
              Connected to your team workspace
            </div>
          </section>

          <section className="flex flex-col justify-between rounded-3xl border border-[#e1e5de] bg-white p-8 sm:p-10" aria-label="Task summary">
            <div className="flex items-start justify-between">
              <div className="grid size-12 place-items-center rounded-2xl bg-[#e8f0e8] text-[#315a4a]">
                <ListTodo className="size-6" aria-hidden="true" />
              </div>
              <ArrowUpRight className="size-5 text-[#8a9b93]" aria-hidden="true" />
            </div>
            <div className="mt-10">
              <p className="text-5xl font-semibold tracking-tight" aria-live="polite">{tasks?.count ?? '—'}</p>
              <p className="mt-2 text-sm font-medium text-[#65736f]">Team tasks</p>
            </div>
          </section>
        </div>

        <section className="overflow-hidden rounded-3xl border border-[#e1e5de] bg-white" aria-labelledby="tasks-heading" aria-busy={isLoading}>
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#e9ece7] px-6 py-6 sm:px-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.17em] text-[#557d70]">Overview</p>
              <h2 id="tasks-heading" className="mt-2 font-heading text-2xl font-semibold tracking-tight">Team tasks</h2>
              <p className="mt-1 text-sm text-[#65736f]">A quick look at what your team is working on.</p>
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={isRefreshing}
              onClick={onRefresh}
              className="min-h-11 rounded-xl border-[#d9ded9] px-4 text-[#17333b] hover:bg-[#edf2ed]"
            >
              <RefreshCw className={cn('size-4', isRefreshing && 'motion-safe:animate-spin')} aria-hidden="true" />
              Refresh
            </Button>
          </div>

          {taskError ? (
            <p role="alert" className="mx-6 mt-6 rounded-xl bg-[#f9e7e2] px-4 py-3 text-sm text-[#8b3f31] sm:mx-8">
              {taskError}
            </p>
          ) : null}

          <TaskContent tasks={tasks} taskError={taskError} isLoading={isLoading} />

          {tasks && tasks.count > tasks.results.length ? (
            <p className="border-t border-[#e9ece7] px-6 py-4 text-sm text-[#65736f] sm:px-8">
              Showing {tasks.results.length} of {tasks.count} tasks
            </p>
          ) : null}
        </section>
      </main>
    </div>
  )
}
