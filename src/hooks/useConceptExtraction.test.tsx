import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getCachedConcepts, hasCachedConcepts, useConceptExtraction } from './useConceptExtraction'
import { extractConcepts, type ExtractedConcept } from '../api'

vi.mock('../api', () => ({
  extractConcepts: vi.fn(),
}))

const mockedExtractConcepts = vi.mocked(extractConcepts)

function makeConcept(text: string, id: string, category: ExtractedConcept['category'] = 'abstract'): ExtractedConcept {
  return {
    id,
    text,
    normalizedName: text.toLowerCase(),
    category,
    startIndex: 0,
    endIndex: text.length,
  }
}

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('useConceptExtraction', () => {
  beforeEach(() => {
    mockedExtractConcepts.mockReset()
    const { result } = renderHook(() => useConceptExtraction())
    act(() => {
      result.current.clearCache()
      result.current.reset()
    })
  })

  it('reuses cached results for the same text+model scope', async () => {
    mockedExtractConcepts.mockResolvedValue([makeConcept('dreams', 'c1')])

    const { result } = renderHook(() => useConceptExtraction())

    await act(async () => {
      await result.current.extract('Why do we dream?', 'model-a')
    })

    await act(async () => {
      await result.current.extract('Why do we dream?', 'model-a')
    })

    expect(mockedExtractConcepts).toHaveBeenCalledTimes(1)
    expect(result.current.concepts).toHaveLength(1)
    expect(result.current.sourceText).toBe('Why do we dream?')
  })

  it('refetches when the model changes for the same text', async () => {
    mockedExtractConcepts
      .mockResolvedValueOnce([makeConcept('dreams', 'c1')])
      .mockResolvedValueOnce([makeConcept('sleep', 'c2', 'science')])

    const { result } = renderHook(() => useConceptExtraction())

    await act(async () => {
      await result.current.extract('How do neurons fire?', 'model-a')
    })

    await act(async () => {
      await result.current.extract('How do neurons fire?', 'model-b')
    })

    expect(mockedExtractConcepts).toHaveBeenCalledTimes(2)
    expect(result.current.concepts[0]?.text).toBe('sleep')
  })

  it('ignores stale in-flight responses from older requests', async () => {
    const firstRequest = createDeferred<ExtractedConcept[]>()
    const secondRequest = createDeferred<ExtractedConcept[]>()

    mockedExtractConcepts
      .mockImplementationOnce(() => firstRequest.promise)
      .mockImplementationOnce(() => secondRequest.promise)

    const { result } = renderHook(() => useConceptExtraction())

    let firstPromise: Promise<ExtractedConcept[]> = Promise.resolve([])
    let secondPromise: Promise<ExtractedConcept[]> = Promise.resolve([])

    act(() => {
      firstPromise = result.current.extract('Older context', 'model-a')
    })
    act(() => {
      secondPromise = result.current.extract('Newer context', 'model-a')
    })

    await act(async () => {
      secondRequest.resolve([makeConcept('newer', 'c2')])
      await secondPromise
    })

    await act(async () => {
      firstRequest.resolve([makeConcept('older', 'c1')])
      await firstPromise
    })

    expect(result.current.sourceText).toBe('Newer context')
    expect(result.current.concepts[0]?.text).toBe('newer')
    expect(result.current.error).toBeNull()
  })

  it('returns empty result for blank input and clears state', async () => {
    mockedExtractConcepts.mockResolvedValue([makeConcept('will-not-be-used', 'cx')])
    const { result } = renderHook(() => useConceptExtraction())

    await act(async () => {
      await result.current.extract('Some text', 'model-a')
    })
    expect(result.current.concepts.length).toBeGreaterThan(0)

    await act(async () => {
      const blank = await result.current.extract('   ', 'model-a')
      expect(blank).toEqual([])
    })

    expect(result.current.concepts).toEqual([])
    expect(result.current.sourceText).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('deduplicates concurrent requests for the same scope', async () => {
    const deferred = createDeferred<ExtractedConcept[]>()
    mockedExtractConcepts.mockImplementation(() => deferred.promise)

    const { result } = renderHook(() => useConceptExtraction())

    let firstPromise: Promise<ExtractedConcept[]> = Promise.resolve([])
    let duplicatePromise: Promise<ExtractedConcept[]> = Promise.resolve([])

    act(() => {
      firstPromise = result.current.extract('Shared context', 'model-a')
      duplicatePromise = result.current.extract('Shared context', 'model-a')
    })

    await act(async () => {
      deferred.resolve([makeConcept('shared', 'c-shared')])
      await firstPromise
    })

    await expect(duplicatePromise).resolves.toEqual([])
    expect(mockedExtractConcepts).toHaveBeenCalledTimes(1)
    expect(result.current.concepts[0]?.text).toBe('shared')
  })

  it('handles API errors and recovers after reset', async () => {
    mockedExtractConcepts.mockRejectedValueOnce(new Error('extract failed'))
    const { result } = renderHook(() => useConceptExtraction())

    await act(async () => {
      const res = await result.current.extract('Failure case', 'model-a')
      expect(res).toEqual([])
    })

    expect(result.current.error).toBe('extract failed')
    expect(result.current.concepts).toEqual([])
    expect(result.current.isLoading).toBe(false)

    act(() => {
      result.current.reset()
    })

    expect(result.current.error).toBeNull()
    expect(result.current.sourceText).toBeNull()
    expect(result.current.concepts).toEqual([])
  })

  it('uses fallback error text when extraction rejects with a non-Error value', async () => {
    mockedExtractConcepts.mockRejectedValueOnce('non-error rejection')
    const { result } = renderHook(() => useConceptExtraction())

    await act(async () => {
      const response = await result.current.extract('Fallback error case', 'model-a')
      expect(response).toEqual([])
    })

    expect(result.current.error).toBe('Failed to extract concepts')
    expect(result.current.concepts).toEqual([])
  })

  it('keeps loading active when a stale request settles before the latest pending request', async () => {
    const firstRequest = createDeferred<ExtractedConcept[]>()
    const secondRequest = createDeferred<ExtractedConcept[]>()
    mockedExtractConcepts
      .mockImplementationOnce(() => firstRequest.promise)
      .mockImplementationOnce(() => secondRequest.promise)

    const { result } = renderHook(() => useConceptExtraction())

    let firstPromise: Promise<ExtractedConcept[]> = Promise.resolve([])
    let secondPromise: Promise<ExtractedConcept[]> = Promise.resolve([])

    act(() => {
      firstPromise = result.current.extract('Older pending', 'model-a')
    })
    act(() => {
      secondPromise = result.current.extract('Latest pending', 'model-a')
    })

    await act(async () => {
      firstRequest.reject(new Error('stale failure'))
      await firstPromise
    })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.error).toBeNull()

    await act(async () => {
      secondRequest.resolve([makeConcept('latest', 'c-latest')])
      await secondPromise
    })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.sourceText).toBe('Latest pending')
    expect(result.current.concepts[0]?.text).toBe('latest')
  })

  it('handles reset while a request is in flight without leaving stale pending markers', async () => {
    const pending = createDeferred<ExtractedConcept[]>()
    mockedExtractConcepts.mockImplementationOnce(() => pending.promise)

    const { result } = renderHook(() => useConceptExtraction())

    let requestPromise: Promise<ExtractedConcept[]> = Promise.resolve([])

    act(() => {
      requestPromise = result.current.extract('Reset mid-flight', 'model-a')
    })

    act(() => {
      result.current.reset()
    })

    await act(async () => {
      pending.resolve([makeConcept('late', 'c-late')])
      await requestPromise
    })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.concepts).toEqual([])
    expect(result.current.sourceText).toBeNull()
  })

  it('exposes cache helpers and cache clearing behavior', async () => {
    mockedExtractConcepts.mockResolvedValue([makeConcept('cached', 'c-cache')])
    const { result } = renderHook(() => useConceptExtraction())

    await act(async () => {
      await result.current.extract('Cache me', 'model-z')
    })

    expect(hasCachedConcepts('Cache me', 'model-z')).toBe(true)
    expect(getCachedConcepts('Cache me', 'model-z')?.[0]?.text).toBe('cached')

    act(() => {
      result.current.clearCache()
    })

    expect(hasCachedConcepts('Cache me', 'model-z')).toBe(false)
    expect(getCachedConcepts('Cache me', 'model-z')).toBeUndefined()
  })
})
