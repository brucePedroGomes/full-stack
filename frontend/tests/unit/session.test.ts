import { AxiosError, AxiosHeaders } from 'axios'
import Cookies from 'js-cookie'
import { beforeEach, expect, test, vi } from 'vitest'
import {
  requestWithSession,
  SessionExpiredError,
  signOut,
} from '@/api/session'

const http = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  request: vi.fn(),
}))

vi.mock('axios', async (importOriginal) => {
  const actual = await importOriginal<typeof import('axios')>()
  return { ...actual, default: { ...actual.default, create: () => http } }
})

function httpError(status: number): AxiosError {
  return new AxiosError('Request failed', undefined, undefined, undefined, {
    status,
    statusText: 'Request failed',
    data: {},
    headers: {},
    config: { headers: new AxiosHeaders() },
  })
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve
    reject = onReject
  })
  return { promise, resolve, reject }
}

beforeEach(() => {
  Cookies.set('csrftoken', 'test-csrf')
  http.request.mockImplementation(async ({ headers }) => {
    if (headers.Authorization === 'Bearer expired') throw httpError(401)
    return { data: 'saved' }
  })
})

test('parallel requests share one renewal and retry with the new JWT', async () => {
  const session = { access: 'expired' }
  const renewal = deferred<{ data: { access: string } }>()
  http.post.mockReturnValue(renewal.promise)

  const results = Promise.all([
    requestWithSession('/api/tasks/4/status/', session, {
      method: 'patch', data: { status: 'done' },
    }),
    requestWithSession('/api/users/', session),
  ])
  await vi.waitFor(() => expect(http.post).toHaveBeenCalledOnce())
  renewal.resolve({ data: { access: 'renewed' } })

  await expect(results).resolves.toEqual(['saved', 'saved'])
  expect(http.post).toHaveBeenCalledExactlyOnceWith(
    '/api/auth/browser/token/', undefined,
    { headers: { 'X-CSRFToken': 'test-csrf' }, signal: undefined },
  )
  expect(http.request).toHaveBeenCalledTimes(4)
  expect(http.request).toHaveBeenCalledWith(expect.objectContaining({
    url: '/api/tasks/4/status/',
    method: 'patch', data: { status: 'done' },
    headers: { Authorization: 'Bearer renewed' },
    withCredentials: false,
  }))
})

test('a late 401 retries the current JWT without another renewal', async () => {
  const session = { access: 'expired' }
  const lateRequest = deferred<never>()
  http.request.mockReturnValueOnce(lateRequest.promise)
  http.post.mockResolvedValue({ data: { access: 'renewed' } })

  const lateResult = requestWithSession('/api/users/', session)
  await expect(requestWithSession('/api/tasks/', session)).resolves.toBe('saved')
  lateRequest.reject(httpError(401))

  await expect(lateResult).resolves.toBe('saved')
  expect(http.post).toHaveBeenCalledOnce()
})

test('canceling one request does not cancel renewal for another', async () => {
  const session = { access: 'expired' }
  const controller = new AbortController()
  const renewal = deferred<{ data: { access: string } }>()
  http.post.mockReturnValue(renewal.promise)

  const canceled = requestWithSession('/api/users/', session, {
    signal: controller.signal,
  })
  const completed = requestWithSession('/api/tasks/', session)
  const cancellation = expect(canceled).rejects.toMatchObject({ name: 'AbortError' })
  await vi.waitFor(() => expect(http.post).toHaveBeenCalledOnce())
  controller.abort()
  renewal.resolve({ data: { access: 'renewed' } })

  await cancellation
  await expect(completed).resolves.toBe('saved')
  expect(http.post.mock.calls[0][2].signal).toBeUndefined()
  expect(http.request).toHaveBeenCalledTimes(3)
})

test('a second API 401 ends the session without another retry', async () => {
  const session = { access: 'expired' }
  http.request.mockRejectedValue(httpError(401))
  http.post.mockResolvedValue({ data: { access: 'renewed' } })

  await expect(requestWithSession('/api/tasks/', session)).rejects.toBeInstanceOf(
    SessionExpiredError,
  )

  expect(session.access).toBe('')
  expect(http.request).toHaveBeenCalledTimes(2)
  expect(http.post).toHaveBeenCalledOnce()
})

test('an expired browser session ends all waiting requests', async () => {
  const session = { access: 'expired' }
  http.post.mockRejectedValue(httpError(401))

  const results = await Promise.allSettled([
    requestWithSession('/api/tasks/', session),
    requestWithSession('/api/users/', session),
  ])

  for (const result of results) {
    expect(result).toMatchObject({
      status: 'rejected', reason: expect.any(SessionExpiredError),
    })
  }
  expect(session.access).toBe('')
  expect(http.request).toHaveBeenCalledTimes(2)
  expect(http.post).toHaveBeenCalledOnce()
})

test('a network failure allows a later renewal attempt', async () => {
  const session = { access: 'expired' }
  const networkError = new AxiosError('Network error')
  http.post.mockRejectedValueOnce(networkError)
  http.post.mockResolvedValueOnce({ data: { access: 'renewed' } })

  await expect(requestWithSession('/api/tasks/', session)).rejects.toBe(networkError)
  expect(session.access).toBe('expired')
  await expect(requestWithSession('/api/tasks/', session)).resolves.toBe('saved')
  expect(http.post).toHaveBeenCalledTimes(2)
})

test('a server error does not renew or repeat a write', async () => {
  const session = { access: 'current' }
  const error = httpError(500)
  http.request.mockRejectedValue(error)

  await expect(requestWithSession('/api/tasks/', session, {
    method: 'post', data: { title: 'Report' },
  })).rejects.toBe(error)

  expect(http.request).toHaveBeenCalledOnce()
  expect(http.post).not.toHaveBeenCalled()
})

test('a late renewal cannot restore access or retry a write after logout', async () => {
  const session = { access: 'expired' }
  const renewal = deferred<{ data: { access: string } }>()
  http.post.mockReturnValueOnce(renewal.promise)
  http.post.mockResolvedValueOnce({ data: undefined })

  const pending = requestWithSession('/api/tasks/4/status/', session, {
    method: 'patch', data: { status: 'done' },
  })
  const rejected = expect(pending).rejects.toBeInstanceOf(SessionExpiredError)
  await vi.waitFor(() => expect(http.post).toHaveBeenCalledOnce())
  await signOut(session)
  renewal.resolve({ data: { access: 'too-late' } })

  await rejected
  expect(session.access).toBe('')
  await expect(requestWithSession('/api/users/', session)).rejects.toBeInstanceOf(
    SessionExpiredError,
  )
  expect(http.request).toHaveBeenCalledOnce()
})

test('an API response after logout cannot return private data', async () => {
  const session = { access: 'current' }
  const response = deferred<{ data: string }>()
  http.request.mockReturnValue(response.promise)
  http.post.mockResolvedValue({ data: undefined })

  const pending = requestWithSession('/api/users/', session)
  const rejected = expect(pending).rejects.toBeInstanceOf(SessionExpiredError)
  await signOut(session)
  response.resolve({ data: 'private data' })

  await rejected
})

test('a failed logout keeps the session so the user can try again', async () => {
  const session = { access: 'current' }
  const networkError = new AxiosError('Network error')
  http.post.mockRejectedValue(networkError)

  await expect(signOut(session)).rejects.toBe(networkError)

  expect(session.access).toBe('current')
})
