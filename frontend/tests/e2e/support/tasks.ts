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
  if (params.has('due_date') && task.due_date !== params.get('due_date'))
    return false
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

  return async function handleTasks(route: Route): Promise<void> {
    const request = route.request()
    const url = new URL(request.url())
    const method = request.method()

    if (url.pathname === '/api/tasks/' && method === 'GET') {
      const matches = tasks
        .filter((task) => matchesFilters(task, url.searchParams))
        .sort((a, b) =>
          url.searchParams.get('ordering') === '-id'
            ? b.id - a.id
            : a.id - b.id,
        )
      await route.fulfill({ json: paginate(matches, url, 10) })
      return
    }
    if (url.pathname === '/api/tasks/' && method === 'POST') {
      const values: TaskInput = request.postDataJSON()
      const task: Task = {
        ...values,
        id: nextId++,
        status: 'planned',
        assignee: findAssignee(values.assigned_to),
      }
      tasks.push(task)
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
      await route.fulfill({ json: { status: task.status } })
      return
    }
    if (method === 'PATCH') {
      const values: TaskInput = request.postDataJSON()
      Object.assign(task, values, {
        assignee: findAssignee(values.assigned_to),
      })
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
