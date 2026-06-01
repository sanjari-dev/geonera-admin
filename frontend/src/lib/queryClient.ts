import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,        // 15 s
      refetchInterval: 30_000,  // poll every 30 s
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
})
