import { expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LoginForm } from '@/components/LoginForm'

test('requires credentials before submitting', async () => {
  /** Uses browser validation for empty fields. */
  const user = userEvent.setup()
  const onSignIn = vi.fn()
  render(
    <LoginForm onSignIn={onSignIn} pending={false} error={null} notice="" />,
  )
  await user.click(screen.getByRole('button', { name: 'Sign in' }))
  expect(screen.getByLabelText('Username')).toBeInvalid()
  expect(screen.getByLabelText('Password')).toBeInvalid()
  expect(onSignIn).not.toHaveBeenCalled()
})

test('trims the username but keeps the password unchanged', async () => {
  /** Preserves spaces that may be part of a password. */
  const user = userEvent.setup()
  const onSignIn = vi.fn()
  render(
    <LoginForm onSignIn={onSignIn} pending={false} error={null} notice="" />,
  )
  await user.type(screen.getByLabelText('Username'), ' ana ')
  await user.type(screen.getByLabelText('Password'), ' secret ')
  await user.click(screen.getByRole('button', { name: 'Sign in' }))
  expect(onSignIn).toHaveBeenCalledExactlyOnceWith({
    username: 'ana',
    password: ' secret ',
  })
})

test('rejects a whitespace username and clears the error after correction', async () => {
  /** Validates the form before sending credentials. */
  const user = userEvent.setup()
  const onSignIn = vi.fn()
  render(
    <LoginForm onSignIn={onSignIn} pending={false} error={null} notice="" />,
  )
  await user.type(screen.getByLabelText('Username'), '   ')
  await user.type(screen.getByLabelText('Password'), ' secret ')
  await user.click(screen.getByRole('button', { name: 'Sign in' }))
  expect(screen.getByRole('alert')).toHaveTextContent('Enter your username.')
  expect(screen.getByLabelText('Username')).toBeInvalid()
  expect(screen.getByLabelText('Username')).toHaveAccessibleDescription('Enter your username.')
  expect(screen.getByLabelText('Password')).toBeValid()
  expect(onSignIn).not.toHaveBeenCalled()
  await user.clear(screen.getByLabelText('Username'))
  await user.type(screen.getByLabelText('Username'), 'ana')
  await user.click(screen.getByRole('button', { name: 'Sign in' }))
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.getByLabelText('Username')).toBeValid()
  expect(screen.getByLabelText('Username')).not.toHaveAccessibleDescription()
  expect(onSignIn).toHaveBeenCalledExactlyOnceWith({
    username: 'ana',
    password: ' secret ',
  })
})
