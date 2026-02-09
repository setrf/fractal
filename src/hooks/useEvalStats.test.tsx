import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useEvalStats } from './useEvalStats'
import { getEvalStats } from '../api'

vi.mock('../api', () => ({
  getEvalStats: vi.fn(),
}))

const mockedGetEvalStats = vi.mocked(getEvalStats)

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('useEvalStats', () => {
  beforeEach(() => {
    mockedGetEvalStats.mockReset()
  })

  it('loads evaluation stats successfully', async () => {
    const data = {
      leaderboard: [{ modelId: 'model-a', meanScore: 0.8, passRate: 0.9, ci95: [0.75, 0.85] as [number, number] }],
      recentRuns: [{ runId: 'run_1', timestamp: '2026-01-01T00:00:00.000Z', modelId: 'model-a', aggregateScore: 0.8 }],
      coverage: { totalPrompts: 12, uniquePrompts: 10 },
      summary: { totalRuns: 3 },
    }
    mockedGetEvalStats.mockResolvedValue(data as never)

    const { result } = renderHook(() => useEvalStats())

    let response: unknown = null
    await act(async () => {
      response = await result.current.refresh()
    })

    expect(response).toEqual(data)
    expect(result.current.stats).toEqual(data)
    expect(result.current.error).toBeNull()
    expect(result.current.isLoading).toBe(false)
  })

  it('captures errors from the API', async () => {
    mockedGetEvalStats.mockRejectedValue(new Error('eval service unavailable'))
    const { result } = renderHook(() => useEvalStats())

    await act(async () => {
      const response = await result.current.refresh()
      expect(response).toBeNull()
    })

    expect(result.current.stats).toBeNull()
    expect(result.current.error).toBe('eval service unavailable')
    expect(result.current.isLoading).toBe(false)
  })

  it('ignores stale responses from earlier requests', async () => {
    const first = createDeferred<any>()
    const second = createDeferred<any>()
    mockedGetEvalStats
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise)

    const { result } = renderHook(() => useEvalStats())

    let firstPromise: Promise<unknown> = Promise.resolve()
    let secondPromise: Promise<unknown> = Promise.resolve()

    act(() => {
      firstPromise = result.current.refresh()
      secondPromise = result.current.refresh()
    })
    expect(result.current.isLoading).toBe(true)

    await act(async () => {
      second.resolve({
        leaderboard: [{ modelId: 'model-new' }],
        recentRuns: [],
        coverage: { totalPrompts: 1, uniquePrompts: 1 },
        summary: { totalRuns: 1 },
      })
      await secondPromise
    })

    await act(async () => {
      first.resolve({
        leaderboard: [{ modelId: 'model-old' }],
        recentRuns: [],
        coverage: { totalPrompts: 99, uniquePrompts: 99 },
        summary: { totalRuns: 99 },
      })
      await firstPromise
    })

    expect(result.current.stats).toEqual(
      expect.objectContaining({
        leaderboard: [{ modelId: 'model-new' }],
      })
    )
    expect(result.current.isLoading).toBe(false)
  })
})
