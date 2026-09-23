import type { ReactElement } from 'react'
import { getApiErrorMessage, type Credentials } from '@/api/session'

type LoginFormProps = {
  onSignIn: (values: Credentials) => void
  pending: boolean
  error: Error | null
  notice: string
}

export function LoginForm({
  onSignIn,
  pending,
  error,
  notice,
}: LoginFormProps): ReactElement {
  return (
    <main className="mx-auto max-w-sm px-6 py-16 text-gray-900">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      {notice ? (
        <p role="status" className="mt-4">
          {notice}
        </p>
      ) : null}
      <form
        className="mt-6 space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          const data = new FormData(event.currentTarget)
          onSignIn({
            username: String(data.get('username')).trim(),
            password: String(data.get('password')),
          })
        }}
      >
        <label className="block">
          Username
          <input
            className="mt-1 min-h-11 w-full rounded border border-gray-300 px-3 focus:outline-2 focus:outline-blue-600"
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            required
          />
        </label>
        <label className="block">
          Password
          <input
            className="mt-1 min-h-11 w-full rounded border border-gray-300 px-3 focus:outline-2 focus:outline-blue-600"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </label>
        {error ? (
          <p role="alert" className="text-red-700">
            {getApiErrorMessage(error)}
          </p>
        ) : null}
        <button
          className="min-h-11 w-full rounded bg-blue-700 px-4 text-white hover:bg-blue-800 disabled:opacity-50"
          disabled={pending}
        >
          {pending ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </main>
  )
}
