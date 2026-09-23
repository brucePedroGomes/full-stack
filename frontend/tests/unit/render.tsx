import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement, ReactNode } from 'react'

const clients = new Set<QueryClient>()

export function createTestQueryClient(): QueryClient {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
  clients.add(client)
  return client
}

export function clearQueryClients(): void {
  for (const client of clients) client.clear()
  clients.clear()
}

export function createQueryWrapper(client = createTestQueryClient()) {
  return function QueryWrapper({
    children,
  }: {
    children: ReactNode
  }): ReactElement {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

export function renderWithQuery(
  ui: ReactElement,
  client = createTestQueryClient(),
) {
  return {
    user: userEvent.setup(),
    ...render(ui, { wrapper: createQueryWrapper(client) }),
  }
}
