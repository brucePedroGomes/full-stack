import { beforeEach, expect, test, vi } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import { requestWithSession, type Session } from '@/api/session'
import type { Task } from '@/api/tasks'
import { TaskPage } from '@/components/TaskPage'
import { TaskProvider } from '@/contexts/TaskContext'
import { makeSignedInSession, makeTask, makeUsers } from '../support/fixtures'
import { renderWithQuery } from './render'

vi.mock('@/api/session', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/session')>()),
  requestWithSession: vi.fn(),
}))

type RequestOptions = Parameters<typeof requestWithSession>[2]

const signedInSession = makeSignedInSession()
const plannedTask = makeTask()

async function fakeApi(path: string, _session: Session, options?: RequestOptions) {
  if (options?.method === 'post' || options?.method === 'patch')
    return { ...plannedTask, ...(options.data as Partial<Task>) }
  if (options?.method === 'delete') return undefined
  if (path.startsWith('/api/users/')) return { count: 2, next: null, results: makeUsers() }
  const tasks = path.includes('status=planned') ? [plannedTask] : []
  return { count: tasks.length, next: null, results: tasks }
}

beforeEach(() => {
  vi.mocked(requestWithSession).mockImplementation(fakeApi)
})

function openTaskPage() {
  return renderWithQuery(
    <TaskProvider {...signedInSession} onSessionExpired={vi.fn()}>
      <TaskPage />
    </TaskProvider>,
  )
}

function lastRequest() {
  return vi.mocked(requestWithSession).mock.calls.findLast(
    ([, , options]) => options?.method !== undefined,
  )
}

test('creates a new task from the form', async () => {
  const { user } = openTaskPage()

  await user.click(screen.getByRole('button', { name: 'New task' }))
  await user.type(screen.getByLabelText('Title'), 'Write tests')
  await user.click(screen.getByRole('button', { name: 'Assigned to' }))
  await user.click(await screen.findByRole('option', { name: 'Bruno Costa' }))
  await user.click(screen.getByRole('button', { name: 'Save task' }))

  expect(await screen.findByText('Saved "Write tests".')).toBeVisible()
  expect(lastRequest()).toEqual([
    '/api/tasks/',
    signedInSession.session,
    {
      method: 'post',
      data: { title: 'Write tests', description: '', due_date: null, assigned_to: 2 },
    },
  ])
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('shows an error when the title is only spaces', async () => {
  const { user } = openTaskPage()

  await user.click(screen.getByRole('button', { name: 'New task' }))
  await user.type(screen.getByLabelText('Title'), '   ')
  await user.click(screen.getByRole('button', { name: 'Save task' }))

  expect(screen.getByText('Enter a task title.')).toBeVisible()
  expect(lastRequest()).toBeUndefined()
})

test('edits an existing task', async () => {
  const { user } = openTaskPage()

  await user.click(await screen.findByRole('button', { name: 'Edit Prepare report' }))
  await user.clear(screen.getByLabelText('Title'))
  await user.type(screen.getByLabelText('Title'), 'Final report')
  await user.click(screen.getByRole('button', { name: 'Save task' }))

  expect(await screen.findByText('Saved "Final report".')).toBeVisible()
  expect(lastRequest()?.[0]).toBe('/api/tasks/4/')
})

test('deletes a task after confirmation', async () => {
  const { user } = openTaskPage()

  await user.click(await screen.findByRole('button', { name: 'Edit Prepare report' }))
  await user.click(screen.getByRole('button', { name: 'Delete' }))
  const confirm = screen.getByRole('alertdialog', { name: 'Delete task?' })
  await user.click(within(confirm).getByRole('button', { name: 'Delete' }))

  expect(await screen.findByText('Deleted "Prepare report".')).toBeVisible()
  expect(lastRequest()).toEqual([
    '/api/tasks/4/',
    signedInSession.session,
    { method: 'delete' },
  ])
})

test('asks before closing the form with unsaved changes', async () => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  const { user } = openTaskPage()

  await user.click(screen.getByRole('button', { name: 'New task' }))
  await user.type(screen.getByLabelText('Title'), 'Draft')
  await user.click(screen.getByRole('button', { name: 'Cancel' }))

  expect(confirm).toHaveBeenCalledWith('Discard your changes?')
  expect(screen.getByRole('dialog', { name: 'New task' })).toBeVisible()
})

test('adds a card to a column', async () => {
  const { user } = openTaskPage()
  const column = screen.getByRole('region', { name: 'To do' })

  await user.click(within(column).getByRole('button', { name: 'Add a card' }))
  await user.type(within(column).getByLabelText('Title for a new To do card'), 'Call client')
  await user.click(within(column).getByRole('button', { name: 'Add card' }))

  expect(await screen.findByText('Added "Call client".')).toBeVisible()
  expect(lastRequest()?.[2]).toEqual({
    method: 'post',
    data: {
      title: 'Call client',
      description: '',
      due_date: null,
      assigned_to: null,
      status: 'to_do',
    },
  })
})

test('closes the quick add form with Escape', async () => {
  const { user } = openTaskPage()
  const column = screen.getByRole('region', { name: 'Done' })

  await user.click(within(column).getByRole('button', { name: 'Add a card' }))
  await user.keyboard('{Escape}')

  expect(within(column).getByRole('button', { name: 'Add a card' })).toBeVisible()
})

test('moves a task with the status select', async () => {
  const { user } = openTaskPage()

  await user.click(await screen.findByRole('button', { name: /Status for Prepare report/ }))
  await user.click(screen.getByRole('option', { name: 'Done' }))

  expect(await screen.findByText('Moved "Prepare report" to Done.')).toBeVisible()
  expect(lastRequest()?.[0]).toBe('/api/tasks/4/status/')
})

test('moves a task by dragging it to another column', async () => {
  openTaskPage()
  const dragged = new Map<string, string>()
  const dataTransfer = {
    setData: (type: string, value: string) => dragged.set(type, value),
    getData: (type: string) => dragged.get(type) ?? '',
  }

  const card = (await screen.findByText('Prepare report')).closest('li')!
  fireEvent.dragStart(card, { dataTransfer })
  fireEvent.drop(screen.getByRole('region', { name: 'Blocked' }), { dataTransfer })

  expect(await screen.findByText('Moved "Prepare report" to Blocked.')).toBeVisible()
})

test('shows the server error when saving fails', async () => {
  const { user } = openTaskPage()
  await screen.findByText('Prepare report')
  vi.mocked(requestWithSession).mockRejectedValueOnce(new Error('Title already exists.'))

  await user.click(screen.getByRole('button', { name: 'New task' }))
  await user.type(screen.getByLabelText('Title'), 'Write tests')
  await user.click(screen.getByRole('button', { name: 'Save task' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Title already exists.')
})

test('shows a column error and loads again on retry', async () => {
  vi.mocked(requestWithSession).mockRejectedValueOnce(new Error('Server is down.'))
  const { user } = openTaskPage()
  const column = screen.getByRole('region', { name: 'Planned' })

  expect(await within(column).findByRole('alert')).toHaveTextContent('Server is down.')
  await user.click(within(column).getByRole('button', { name: 'Retry' }))

  expect(await within(column).findByText('Prepare report')).toBeVisible()
})

test('shows more tasks when the column has another page', async () => {
  vi.mocked(requestWithSession).mockImplementation(async (path) => {
    if (!path.includes('status=planned')) return { count: 0, next: null, results: [] }
    return path.includes('page=1')
      ? { count: 2, next: 'page-2', results: [plannedTask] }
      : { count: 2, next: null, results: [makeTask({ id: 5, title: 'Second task' })] }
  })
  const { user } = openTaskPage()

  await user.click(await screen.findByRole('button', { name: 'Show more' }))

  expect(await screen.findByText('Second task')).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument()
})

test('shows a users error in the form and loads them again on retry', async () => {
  vi.mocked(requestWithSession).mockImplementation(async (path, ...rest) => {
    if (path.startsWith('/api/users/')) throw new Error('Users are unavailable.')
    return fakeApi(path, ...rest)
  })
  const { user } = openTaskPage()

  await user.click(screen.getByRole('button', { name: 'New task' }))
  const form = screen.getByRole('dialog', { name: 'New task' })
  expect(await within(form).findByText('Users are unavailable.')).toBeVisible()

  vi.mocked(requestWithSession).mockImplementation(fakeApi)
  await user.click(within(form).getByRole('button', { name: 'Retry users' }))
  await user.click(within(form).getByRole('button', { name: 'Assigned to' }))
  expect(await screen.findByRole('option', { name: 'Bruno Costa' })).toBeVisible()
})
