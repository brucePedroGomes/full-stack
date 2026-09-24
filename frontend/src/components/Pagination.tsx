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
  return (
    <nav aria-label={label} className="flex flex-wrap items-center gap-3">
      <Button
        type="button"
        disabled={busy || page === 1}
        onClick={() => onChange(page - 1)}
      >
        <Icon name="previous" className="size-4" /> Previous
      </Button>
      <span>Page {page}</span>
      <Button
        type="button"
        disabled={busy || !hasNext}
        onClick={() => onChange(page + 1)}
      >
        Next <Icon name="next" className="size-4" />
      </Button>
    </nav>
  )
}
