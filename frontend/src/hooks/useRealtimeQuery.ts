import { useEffect, useRef } from 'react'
import { useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query'
import { wsEvents } from '@/lib/wsEvents'

/**
 * Drop-in replacement for useQuery that receives live data via WebSocket.
 * - Runs the queryFn once on mount for an immediate initial value.
 * - After that, the React Query cache is updated directly from WS events —
 *   no polling interval needed.
 */
export function useRealtimeQuery<TData>(
  wsEventType: string,
  options: UseQueryOptions<TData>,
) {
  const queryClient = useQueryClient()
  // Stable ref so the effect closure always has the current key without re-subscribing.
  const keyRef = useRef(options.queryKey)
  keyRef.current = options.queryKey

  useEffect(() => {
    return wsEvents.on(wsEventType, (data) => {
      queryClient.setQueryData(keyRef.current!, data as TData)
    })
  }, [wsEventType, queryClient])

  return useQuery<TData>({
    ...options,
    refetchInterval: false,
    staleTime: Infinity,
  })
}
