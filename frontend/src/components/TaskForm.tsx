import { useCallback, useEffect, useState, type SubmitEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  getApiErrorMessage,
  SessionExpiredError,
  type Session,
} from '@/api/session'
import {
  createTask,
  deleteTask,
  taskInputSchema,
  updateTask,
  type Task,
  type TaskInput,
} from '@/api/tasks'
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
  session: Session
  onClose: () => void
  onSaved: () => Promise<void>
  onSessionExpired: (message: string) => void
}

export function TaskForm({
  task,
  session,
  onClose,
  onSaved,
  onSessionExpired,
}: TaskFormProps) {
  const [validationError, setValidationError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [assignee, setAssignee] = useState<number | 'unassigned'>(
    task?.assigned_to ?? 'unassigned',
  )
  const users = useUserOptions(session, onSessionExpired, task?.assignee)
  const assigneeOptions: SelectOption<number | 'unassigned'>[] = [
    { value: 'unassigned', label: 'Unassigned' },
    ...users.options,
  ]
  const save = useMutation({
    mutationFn: (values: TaskInput) =>
      task ? updateTask(session, task.id, values) : createTask(session, values),
    onSuccess: onSaved,
  })
  const remove = useMutation({
    mutationFn: (id: number) => deleteTask(session, id),
    onSuccess: onSaved,
  })
  const busy = save.isPending || remove.isPending
  const error = save.error || remove.error
  const { mutate: saveTask, reset: resetSave } = save
  const { mutate: removeTask, reset: resetRemove } = remove

  const handleSubmit = useCallback(
    (event: SubmitEvent<HTMLFormElement>) => {
      event.preventDefault()
      const result = taskInputSchema.safeParse({
        ...Object.fromEntries(new FormData(event.currentTarget)),
        assigned_to: assignee === 'unassigned' ? null : assignee,
      })
      if (!result.success) {
        setValidationError(result.error.issues[0].message)
        return
      }
      setValidationError('')
      resetRemove()
      saveTask(result.data)
    },
    [assignee, resetRemove, saveTask],
  )
  const handleRequestDelete = useCallback(() => {
    resetRemove()
    setConfirmDelete(true)
  }, [resetRemove])
  const handleCancelDelete = useCallback(() => setConfirmDelete(false), [])
  const handleDelete = useCallback(() => {
    if (task) {
      setValidationError('')
      resetSave()
      removeTask(task.id)
    }
  }, [task, resetSave, removeTask])

  useEffect(() => {
    if (error instanceof SessionExpiredError) onSessionExpired(error.message)
  }, [error, onSessionExpired])

  return (
    <Dialog
      open
      title={task ? 'Edit task' : 'New task'}
      onClose={onClose}
      closeDisabled={busy}
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <Fieldset disabled={busy}>
          <Input
            label="Title"
            name="title"
            required
            maxLength={200}
            defaultValue={task?.title ?? ''}
            autoFocus
          />
          <Textarea
            label="Description"
            name="description"
            rows={3}
            defaultValue={task?.description ?? ''}
          />
          <Input
            label="Due date"
            name="due_date"
            type="date"
            max="9999-12-31"
            defaultValue={task?.due_date ?? ''}
          />
          <div className="min-w-0 space-y-2">
            <Select
              label="Assigned to"
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
        {validationError || save.error ? (
          <p role="alert" className="text-red-700">
            {validationError || getApiErrorMessage(save.error)}
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
          <Button disabled={busy} onClick={onClose}>
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
          onClose={handleCancelDelete}
          pending={remove.isPending}
          error={remove.error ? getApiErrorMessage(remove.error) : undefined}
        />
      ) : null}
    </Dialog>
  )
}
