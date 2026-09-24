import type { Route } from '@playwright/test'
import type { Task, TaskInput, TaskStatus } from '@/api/tasks'
import type { UserSummary } from '@/api/users'
import { paginate } from './pagination'

function matchesFilters(task: Task, params: URLSearchParams): boolean {
  if (
    params.has('assigned_to') &&
    task.assigned_to !== Number(params.get('assigned_to'))
  )
    return false
  if (params.get('unassigned') === 'true' && task.assigned_to !== null)
    return false
  if (params.has('status') && task.status !== params.get('status')) return false
  if (params.get('due') === 'overdue' && !task.is_overdue) return false
  const terms = (params.get('search') ?? '').toLowerCase().split(/\s+/)
  const text = `${task.title} ${task.description}`.toLowerCase()
  return terms.every((term) => text.includes(term))
}

export function createTaskHandler(initialTasks: Task[], users: UserSummary[]) {
  function findAssignee(id: number | null): UserSummary | null {
    return users.find((user) => user.id === id) ?? null
  }

  let tasks = initialTasks.map((task) => ({
    ...task,
    assignee: findAssignee(task.assigned_to),
  }))
  let nextId = Math.max(0, ...tasks.map((task) => task.id)) + 1
  let clock = nextId
  const updatedAt = new Map(tasks.map((task) => [task.id, task.id]))
  function touch(task: Task): void {
    updatedAt.set(task.id, clock++)
  }
  function lastChange(task: Task): number {
    return updatedAt.get(task.id) ?? 0
  }

  return async function handleTasks(route: Route): Promise<void> {
    const request = route.request()
    const url = new URL(request.url())
    const method = request.method()

    if (url.pathname === '/api/tasks/' && method === 'GET') {
      const matches = tasks
        .filter((task) => matchesFilters(task, url.searchParams))
        .sort((a, b) => lastChange(b) - lastChange(a) || b.id - a.id)
      await route.fulfill({ json: paginate(matches, url, 20) })
      return
    }
    if (url.pathname === '/api/tasks/' && method === 'POST') {
      const values: TaskInput & { status?: TaskStatus } = request.postDataJSON()
      const task: Task = {
        ...values,
        id: nextId++,
        status: values.status ?? 'planned',
        assignee: findAssignee(values.assigned_to),
        is_overdue: false,
      }
      tasks.push(task)
      touch(task)
      await route.fulfill({ status: 201, json: task })
      return
    }

    const id = Number(url.pathname.split('/')[3])
    const task = tasks.find((item) => item.id === id)
    if (!task) {
      await route.fulfill({ status: 404, json: { detail: 'Not found.' } })
      return
    }
    if (method === 'PATCH' && url.pathname.endsWith('/status/')) {
      const body: { status: TaskStatus } = request.postDataJSON()
      task.status = body.status
      touch(task)
      await route.fulfill({ json: { status: task.status } })
      return
    }
    if (method === 'PATCH') {
      const values: TaskInput = request.postDataJSON()
      Object.assign(task, values, {
        assignee: findAssignee(values.assigned_to),
      })
      touch(task)
      await route.fulfill({ json: task })
      return
    }
    if (method === 'DELETE') {
      tasks = tasks.filter((item) => item.id !== id)
      await route.fulfill({ status: 204 })
      return
    }
    await route.fulfill({ status: 405 })
  }
}
