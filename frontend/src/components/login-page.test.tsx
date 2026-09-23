import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LoginPage } from './login-page'

afterEach(cleanup)

test('shows required field messages before sending credentials', async () => {
  /** Checks that an empty form does not call the login API. */
  const user = userEvent.setup()
  const onSignIn = vi.fn(async () => {})
  render(<LoginPage onSignIn={onSignIn} notice="" />)

  await user.click(screen.getByRole('button', { name: 'Sign in' }))

  expect(await screen.findByText('Enter your username.')).toBeTruthy()
  expect(screen.getByText('Enter your password.')).toBeTruthy()
  expect(onSignIn).not.toHaveBeenCalled()
})

test('sends credentials and shows a login error', async () => {
  /** Checks the submitted fields and a rejected login response. */
  const user = userEvent.setup()
  const onSignIn = vi.fn(async () => {
    throw new Error('The username or password is incorrect.')
  })
  render(<LoginPage onSignIn={onSignIn} notice="" />)

  await user.type(screen.getByLabelText('Username'), 'ana')
  await user.type(screen.getByLabelText('Password'), 'wrong-password')
  await user.click(screen.getByRole('button', { name: 'Sign in' }))

  await waitFor(() => {
    expect(onSignIn).toHaveBeenCalledWith({ username: 'ana', password: 'wrong-password' })
  })
  expect((await screen.findByRole('alert')).textContent).toBe('The username or password is incorrect.')
})
