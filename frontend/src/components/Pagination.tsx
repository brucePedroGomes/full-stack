import { useCallback } from 'react'
import { Button, Icon } from './ui'

type PaginationProps = {
  label: string
  page: number
  hasNext: boolean
  busy: boolean
  onChange: (page: number) => void
}

export function Pagination({
  label,
  page,
  hasNext,
  busy,
  onChange,
}: PaginationProps) {
  const handlePrevious = useCallback(() => onChange(page - 1), [onChange, page])
  const handleNext = useCallback(() => onChange(page + 1), [onChange, page])

  return (
    <nav aria-label={label} className="flex flex-wrap items-center gap-3">
      <Button
        type="button"
        disabled={busy || page === 1}
        onClick={handlePrevious}
      >
        <Icon name="previous" className="size-4" /> Previous
      </Button>
      <span>Page {page}</span>
      <Button
        type="button"
        disabled={busy || !hasNext}
        onClick={handleNext}
      >
        Next <Icon name="next" className="size-4" />
      </Button>
    </nav>
  )
}
