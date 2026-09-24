import { useState, type SubmitEvent } from 'react'
import { getApiErrorMessage } from '@/api/session'
import { taskInputSchema, type Task, type TaskInput } from '@/api/tasks'
import { useTaskContext } from '@/contexts/TaskContext'
import { useUserOptions } from '@/hooks/useUserOptions'
import {
  Button,
  ConfirmDialog,
  Dialog,
  Fieldset,
  Icon,
  Input,
  Select,
  Textarea,
  type SelectOption,
} from './ui'

type TaskFormProps = {
  task: Task | null
}

export function TaskForm({ task }: TaskFormProps) {
  const { save, remove, closeEditor } = useTaskContext()
  const [validationErrors, setValidationErrors] = useState<
    Partial<Record<keyof TaskInput, string>>
  >({})
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [assignee, setAssignee] = useState<number | 'unassigned'>(
    task?.assigned_to ?? 'unassigned',
  )
  const users = useUserOptions(task?.assignee)
  const assigneeOptions: SelectOption<number | 'unassigned'>[] = [
    { value: 'unassigned', label: 'Unassigned' },
    ...users.options,
  ]
  const busy = save.isPending || remove.isPending

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = taskInputSchema.safeParse({
      ...Object.fromEntries(new FormData(event.currentTarget)),
      assigned_to: assignee === 'unassigned' ? null : assignee,
    })
    if (!result.success) {
      setValidationErrors(
        Object.fromEntries(
          result.error.issues.map((issue) => [issue.path[0], issue.message]),
        ),
      )
      return
    }
    setValidationErrors({})
    remove.reset()
    save.mutate(result.data)
  }

  function handleRequestDelete() {
    remove.reset()
    setConfirmDelete(true)
  }

  function handleDelete() {
    if (task) {
      setValidationErrors({})
      save.reset()
      remove.mutate(task.id)
    }
  }

  return (
    <Dialog
      open
      title={task ? 'Edit task' : 'New task'}
      onClose={closeEditor}
      closeDisabled={busy}
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <Fieldset disabled={busy}>
          <Input
            label="Title"
            name="title"
            error={validationErrors.title}
            required
            maxLength={200}
            defaultValue={task?.title ?? ''}
            autoFocus
          />
          <Textarea
            label="Description"
            name="description"
            error={validationErrors.description}
            rows={3}
            defaultValue={task?.description ?? ''}
          />
          <Input
            label="Due date"
            name="due_date"
            error={validationErrors.due_date}
            type="date"
            max="9999-12-31"
            defaultValue={task?.due_date ?? ''}
          />
          <div className="min-w-0 space-y-2">
            <Select
              label="Assigned to"
              error={validationErrors.assigned_to}
              value={assignee}
              onChange={setAssignee}
              options={assigneeOptions}
            />
            {users.isPending ? (
              <p role="status" className="text-sm text-gray-600">
                Loading users...
              </p>
            ) : null}
            {users.error ? (
              <div role="alert" className="text-sm text-red-700">
                <p>{getApiErrorMessage(users.error)}</p>
                <Button variant="plain" onClick={users.retry}>
                  Retry users
                </Button>
              </div>
            ) : null}
          </div>
        </Fieldset>
        {save.error ? (
          <p role="alert" className="text-red-700">
            {getApiErrorMessage(save.error)}
          </p>
        ) : null}
        <div className="flex flex-wrap justify-end gap-3 border-t border-gray-200 pt-4">
          {task ? (
            <Button
              variant="danger"
              disabled={busy}
              onClick={handleRequestDelete}
              className="mr-auto"
            >
              <Icon name="delete" /> Delete
            </Button>
          ) : null}
          <Button disabled={busy} onClick={closeEditor}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {save.isPending ? 'Saving...' : 'Save task'}
          </Button>
        </div>
      </form>
      {task ? (
        <ConfirmDialog
          open={confirmDelete}
          title="Delete task?"
          description={`Delete "${task.title}"? This cannot be undone.`}
          confirmLabel={remove.isPending ? 'Deleting...' : 'Delete'}
          onConfirm={handleDelete}
          onClose={() => setConfirmDelete(false)}
          pending={remove.isPending}
          error={remove.error ? getApiErrorMessage(remove.error) : undefined}
        />
      ) : null}
    </Dialog>
  )
}
