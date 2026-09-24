import type { Task } from '@/api/tasks'
import type { UserSummary } from '@/api/users'
import type { SignedInSession } from '@/api/session'

export function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 4,
    title: 'Prepare report',
    description: 'Write the first draft.',
    status: 'planned',
    due_date: '2026-10-10',
    assigned_to: null,
    assignee: null,
    is_overdue: false,
    ...overrides,
  }
}

export function makeTasks(count: number): Task[] {
  return Array.from({ length: count }, (_, index) =>
    makeTask({ id: index + 1, title: `Task ${index + 1}` }),
  )
}

export function makeUser(overrides: Partial<UserSummary> = {}): UserSummary {
  return {
    id: 1,
    username: 'ana',
    first_name: 'Ana',
    last_name: 'Silva',
    ...overrides,
  }
}

export function makeUsers(): UserSummary[] {
  return [
    makeUser(),
    makeUser({
      id: 2,
      username: 'bruno',
      first_name: 'Bruno',
      last_name: 'Costa',
    }),
  ]
}

export function makeSignedInSession(): SignedInSession {
  return {
    session: { access: 'test-access' },
    account: { ...makeUser(), email: 'ana@example.com' },
  }
}
