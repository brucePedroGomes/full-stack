export function paginate<T>(items: T[], url: URL, defaultSize: number) {
  const page = Number(url.searchParams.get('page') ?? 1)
  const size = Number(url.searchParams.get('page_size') ?? defaultSize)
  const start = (page - 1) * size
  const next = new URL(url)
  next.searchParams.set('page', String(page + 1))
  return {
    count: items.length,
    next: start + size < items.length ? next.href : null,
    previous: null,
    results: items.slice(start, start + size),
  }
}
