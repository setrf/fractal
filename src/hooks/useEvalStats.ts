import { useCallback, useRef, useState } from 'react'
import { getEvalStats, type EvalStatsResponse } from '../api'

type EvalStatsData = EvalStatsResponse['data']

export function useEvalStats() {
  const [stats, setStats] = useState<EvalStatsData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const latestRequestId = useRef(0)

  const refresh = useCallback(async () => {
    const requestId = latestRequestId.current + 1
    latestRequestId.current = requestId
    setIsLoading(true)
    setError(null)
    try {
      const data = await getEvalStats()
      if (latestRequestId.current === requestId) {
        setStats(data)
      }
      return data
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch eval stats'
      if (latestRequestId.current === requestId) {
        setError(message)
      }
      return null
    } finally {
      if (latestRequestId.current === requestId) {
        setIsLoading(false)
      }
    }
  }, [])

  return {
    stats,
    isLoading,
    error,
    refresh,
  }
}
