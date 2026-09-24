import { createRef, useCallback, type SubmitEvent } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { Button, Fieldset, Input, Select, Textarea } from '@/components/ui'

test('select returns typed values and connects its label and description', async () => {
  /** A replacement library must preserve numeric IDs and accessible field text. */
  const user = userEvent.setup()
  const onChange = vi.fn()
  const ref = createRef<HTMLButtonElement>()
  render(
    <Select<number | 'unassigned'>
      ref={ref}
      label="Assignee"
      description="Choose the task owner."
      value="unassigned"
      onChange={onChange}
      options={[
        { value: 'unassigned', label: 'Unassigned' },
        { value: 2, label: 'Bruno' },
      ]}
    />,
  )
  const select = screen.getByRole('button', { name: /Assignee/ })
  expect(select).toHaveAccessibleDescription('Choose the task owner.')
  expect(ref.current).toBe(select)
  await user.click(select)
  await user.click(screen.getByRole('option', { name: 'Bruno' }))
  expect(onChange).toHaveBeenCalledExactlyOnceWith(2)
})

test('fieldset disables all its controls and buttons', async () => {
  /** Group disabling also reaches labeled fields and action callbacks. */
  const user = userEvent.setup()
  const onChange = vi.fn()
  const onClick = vi.fn()
  render(
    <Fieldset disabled>
      <Input label="Title" />
      <Textarea label="Description" />
      <Select
        label="Status"
        value="planned"
        options={[{ value: 'planned', label: 'Planned' }]}
        onChange={onChange}
      />
      <Button onClick={onClick}>Save</Button>
    </Fieldset>,
  )
  expect(screen.getByLabelText('Title')).toBeDisabled()
  expect(screen.getByLabelText('Description')).toBeDisabled()
  expect(screen.getByLabelText('Status')).toBeDisabled()
  const button = screen.getByRole('button', { name: 'Save' })
  expect(button).toBeDisabled()
  await user.click(button)
  expect(onClick).not.toHaveBeenCalled()
})

function FormHarness({ onSubmit }: { onSubmit: (values: FormData) => void }) {
  const handleSubmit = useCallback(
    (event: SubmitEvent<HTMLFormElement>) => {
      event.preventDefault()
      onSubmit(new FormData(event.currentTarget))
    },
    [onSubmit],
  )

  return (
    <form onSubmit={handleSubmit}>
      <Input label="Title" name="title" defaultValue="Draft" required />
      <Button>Preview</Button>
      <Button type="submit">Save</Button>
    </form>
  )
}

test('only explicit submit buttons submit the named form values', async () => {
  /** Adapter buttons must not turn other form actions into accidental submits. */
  const user = userEvent.setup()
  const onSubmit = vi.fn()
  render(<FormHarness onSubmit={onSubmit} />)
  await user.click(screen.getByRole('button', { name: 'Preview' }))
  expect(onSubmit).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: 'Save' }))
  expect(onSubmit).toHaveBeenCalledOnce()
  expect(Object.fromEntries(onSubmit.mock.calls[0][0])).toEqual({ title: 'Draft' })
})
