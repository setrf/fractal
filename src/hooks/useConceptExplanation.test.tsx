import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { hasExplanationCached, useConceptExplanation } from './useConceptExplanation'
import { explainConcept } from '../api'

vi.mock('../api', () => ({
  explainConcept: vi.fn(),
}))

const mockedExplainConcept = vi.mocked(explainConcept)

function makeExplanation(summary: string) {
  return {
    conceptId: 'c1',
    normalizedName: 'dreams',
    summary,
    context: `${summary} context`,
    relatedConcepts: [],
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

function hashString(value: string): string {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0
  }
  return hash.toString(36)
}

function cacheKeyFor(conceptName: string, questionContext: string, model?: string): string {
  const conceptKey = conceptName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  const contextHash = hashString(questionContext.trim().toLowerCase())
  const modelKey = (model || 'default')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
  return `fractal_concept_explanation_${conceptKey}_${contextHash}_${modelKey}`
}

describe('useConceptExplanation cache scoping', () => {
  beforeEach(() => {
    localStorage.clear()
    mockedExplainConcept.mockReset()
  })

  it('reuses explanation only when concept+context+model scope is unchanged', async () => {
    mockedExplainConcept.mockResolvedValue(makeExplanation('first'))

    const { result } = renderHook(() => useConceptExplanation())

    await act(async () => {
      await result.current.fetchExplanation('c1', 'dreams', 'why do we dream?', 'model-a')
    })

    await act(async () => {
      await result.current.fetchExplanation('c1', 'dreams', 'why do we dream?', 'model-a')
    })

    expect(mockedExplainConcept).toHaveBeenCalledTimes(1)
  })

  it('refetches when context changes for the same concept id', async () => {
    mockedExplainConcept
      .mockResolvedValueOnce(makeExplanation('context one'))
      .mockResolvedValueOnce(makeExplanation('context two'))

    const { result } = renderHook(() => useConceptExplanation())

    await act(async () => {
      await result.current.fetchExplanation('c1', 'dreams', 'context one', 'model-a')
    })

    await act(async () => {
      await result.current.fetchExplanation('c1', 'dreams', 'context two', 'model-a')
    })

    expect(mockedExplainConcept).toHaveBeenCalledTimes(2)
  })

  it('refetches when model changes for the same concept/context', async () => {
    mockedExplainConcept
      .mockResolvedValueOnce(makeExplanation('model a'))
      .mockResolvedValueOnce(makeExplanation('model b'))

    const { result } = renderHook(() => useConceptExplanation())

    await act(async () => {
      await result.current.fetchExplanation('c1', 'dreams', 'same context', 'model-a')
    })

    await act(async () => {
      await result.current.fetchExplanation('c1', 'dreams', 'same context', 'model-b')
    })

    expect(mockedExplainConcept).toHaveBeenCalledTimes(2)
  })

  it('ignores stale in-flight responses for older scopes', async () => {
    const firstRequest = createDeferred<ReturnType<typeof makeExplanation>>()
    const secondRequest = createDeferred<ReturnType<typeof makeExplanation>>()
    mockedExplainConcept
      .mockImplementationOnce(() => firstRequest.promise)
      .mockImplementationOnce(() => secondRequest.promise)

    const { result } = renderHook(() => useConceptExplanation())

    let firstPromise: Promise<unknown> = Promise.resolve()
    let secondPromise: Promise<unknown> = Promise.resolve()

    act(() => {
      firstPromise = result.current.fetchExplanation('c1', 'dreams', 'older context', 'model-a')
    })
    act(() => {
      secondPromise = result.current.fetchExplanation('c1', 'dreams', 'newer context', 'model-a')
    })

    await act(async () => {
      secondRequest.resolve(makeExplanation('newest'))
      await secondPromise
    })

    await act(async () => {
      firstRequest.resolve(makeExplanation('stale'))
      await firstPromise
    })

    expect(result.current.getExplanation('c1')?.summary).toBe('newest')
  })

  it('ignores stale in-flight errors from older scopes', async () => {
    const firstRequest = createDeferred<ReturnType<typeof makeExplanation>>()
    const secondRequest = createDeferred<ReturnType<typeof makeExplanation>>()
    mockedExplainConcept
      .mockImplementationOnce(() => firstRequest.promise)
      .mockImplementationOnce(() => secondRequest.promise)

    const { result } = renderHook(() => useConceptExplanation())

    let firstPromise: Promise<unknown> = Promise.resolve()
    let secondPromise: Promise<unknown> = Promise.resolve()

    act(() => {
      firstPromise = result.current.fetchExplanation('c1', 'dreams', 'older context', 'model-a')
    })
    act(() => {
      secondPromise = result.current.fetchExplanation('c1', 'dreams', 'newer context', 'model-a')
    })

    await act(async () => {
      secondRequest.resolve(makeExplanation('newer ok'))
      await secondPromise
    })

    await act(async () => {
      firstRequest.reject(new Error('stale failure'))
      await firstPromise
    })

    expect(result.current.getExplanation('c1')?.summary).toBe('newer ok')
    expect(result.current.error).toBeNull()
  })

  it('deduplicates concurrent requests in the same scope', async () => {
    const deferred = createDeferred<ReturnType<typeof makeExplanation>>()
    mockedExplainConcept.mockImplementation(() => deferred.promise)

    const { result } = renderHook(() => useConceptExplanation())

    let firstPromise: Promise<unknown> = Promise.resolve()
    let duplicatePromise: Promise<unknown> = Promise.resolve()

    act(() => {
      firstPromise = result.current.fetchExplanation('c1', 'dreams', 'same scope', 'model-a')
      duplicatePromise = result.current.fetchExplanation('c1', 'dreams', 'same scope', 'model-a')
    })

    await expect(duplicatePromise).resolves.toBeNull()

    await act(async () => {
      deferred.resolve(makeExplanation('resolved'))
      await firstPromise
    })

    expect(mockedExplainConcept).toHaveBeenCalledTimes(1)
    expect(result.current.getExplanation('c1')?.summary).toBe('resolved')
  })

  it('handles API failures and exposes per-concept loading/error state', async () => {
    mockedExplainConcept.mockRejectedValue(new Error('explain failed'))
    const { result } = renderHook(() => useConceptExplanation())

    await act(async () => {
      const response = await result.current.fetchExplanation('c9', 'failure', 'bad context', 'model-a')
      expect(response).toBeNull()
    })

    expect(result.current.error).toBe('explain failed')
    expect(result.current.getLoadingState('c9')).toEqual({
      isLoading: false,
      error: 'explain failed',
    })
    expect(result.current.explanation).toBeNull()
  })

  it('uses fallback error text when explanation fetch rejects with a non-Error value', async () => {
    mockedExplainConcept.mockRejectedValue('non-error failure')
    const { result } = renderHook(() => useConceptExplanation())

    await act(async () => {
      const response = await result.current.fetchExplanation('c9', 'failure', 'bad context')
      expect(response).toBeNull()
    })

    expect(result.current.error).toBe('Failed to fetch explanation')
    expect(result.current.getLoadingState('c9')).toEqual({
      isLoading: false,
      error: 'Failed to fetch explanation',
    })
  })

  it('uses default model scope when model is omitted', async () => {
    mockedExplainConcept.mockResolvedValue(makeExplanation('default model response'))
    const { result } = renderHook(() => useConceptExplanation())

    await act(async () => {
      await result.current.fetchExplanation('c1', 'dreams', 'default model context')
    })

    expect(hasExplanationCached('dreams', 'default model context')).toBe(true)
    expect(result.current.getExplanation('c1')?.summary).toBe('default model response')
  })

  it('hydrates from localStorage cache for a new concept id in the same scope', async () => {
    mockedExplainConcept.mockResolvedValue(makeExplanation('cached from api'))
    const { result } = renderHook(() => useConceptExplanation())

    await act(async () => {
      await result.current.fetchExplanation('c1', 'dreams', 'same context', 'model-a')
    })
    expect(mockedExplainConcept).toHaveBeenCalledTimes(1)

    mockedExplainConcept.mockClear()

    await act(async () => {
      await result.current.fetchExplanation('c2', 'dreams', 'same context', 'model-a')
    })

    expect(mockedExplainConcept).toHaveBeenCalledTimes(0)
    expect(result.current.getExplanation('c2')?.conceptId).toBe('c2')
    expect(result.current.explanation?.conceptId).toBe('c2')
  })

  it('treats expired cache entries as stale and refetches', async () => {
    const setItemSpy = vi.spyOn(window.localStorage, 'setItem')
    const removeItemSpy = vi.spyOn(window.localStorage, 'removeItem')
    mockedExplainConcept.mockResolvedValue(makeExplanation('fresh'))

    const now = Date.now()
    const dateSpy = vi.spyOn(Date, 'now').mockReturnValue(now)
    const cacheKey = cacheKeyFor('dreams', 'old context', 'model-a')
    localStorage.setItem(cacheKey, JSON.stringify({
      explanation: makeExplanation('expired'),
      timestamp: now - (1000 * 60 * 60 * 25),
    }))

    const { result } = renderHook(() => useConceptExplanation())
    await act(async () => {
      await result.current.fetchExplanation('c1', 'dreams', 'old context', 'model-a')
    })

    expect(removeItemSpy).toHaveBeenCalledWith(cacheKey)
    expect(mockedExplainConcept).toHaveBeenCalledTimes(1)
    expect(setItemSpy).toHaveBeenCalled()

    dateSpy.mockRestore()
    setItemSpy.mockRestore()
    removeItemSpy.mockRestore()
  })

  it('handles malformed cache payloads and storage write warnings', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const malformedKey = cacheKeyFor('dreams', 'bad context', 'model-a')
    const getItemSpy = vi.spyOn(window.localStorage, 'getItem').mockImplementation((key: string) => {
      if (key === malformedKey) {
        return '{bad-json'
      }
      return null
    })
    const setItemSpy = vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    mockedExplainConcept.mockResolvedValue(makeExplanation('from-api'))

    const { result } = renderHook(() => useConceptExplanation())
    await act(async () => {
      await result.current.fetchExplanation('c1', 'dreams', 'bad context', 'model-a')
    })

    expect(getItemSpy).toHaveBeenCalled()
    expect(setItemSpy).toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalledWith('[useConceptExplanation] Failed to cache explanation')

    getItemSpy.mockRestore()
    setItemSpy.mockRestore()
    warnSpy.mockRestore()
  })

  it('supports reset and cache clearing helpers', async () => {
    mockedExplainConcept.mockResolvedValue(makeExplanation('clear me'))
    const { result } = renderHook(() => useConceptExplanation())

    await act(async () => {
      await result.current.fetchExplanation('c1', 'dreams', 'clear context', 'model-a')
    })

    expect(hasExplanationCached('dreams', 'clear context', 'model-a')).toBe(true)
    expect(result.current.getExplanation('c1')).not.toBeNull()

    act(() => {
      result.current.reset()
    })

    expect(result.current.getExplanation('c1')).toBeNull()
    expect(result.current.currentConceptId).toBeNull()
    expect(result.current.explanation).toBeNull()
    expect(result.current.error).toBeNull()
    expect(result.current.getLoadingState('unknown')).toEqual({ isLoading: false, error: null })

    Object.defineProperty(localStorage, 'length', {
      configurable: true,
      get: () => Object.keys(((localStorage as unknown as { store?: Record<string, string> }).store) || {}).length,
    })
    Object.defineProperty(localStorage, 'key', {
      configurable: true,
      value: (index: number) => {
        const keys = Object.keys(((localStorage as unknown as { store?: Record<string, string> }).store) || {})
        return keys[index] ?? null
      },
    })

    act(() => {
      result.current.clearAllCached()
    })

    expect(hasExplanationCached('dreams', 'clear context', 'model-a')).toBe(false)
  })

  it('warns when clearing cache fails', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { result } = renderHook(() => useConceptExplanation())

    Object.defineProperty(localStorage, 'length', {
      configurable: true,
      get: () => {
        throw new Error('length failure')
      },
    })

    act(() => {
      result.current.clearAllCached()
    })

    expect(warnSpy).toHaveBeenCalledWith('[useConceptExplanation] Failed to clear cache')
    warnSpy.mockRestore()
  })

  it('clearAllCached only removes explanation-prefixed keys and skips null/other keys', () => {
    const removeItemSpy = vi.spyOn(window.localStorage, 'removeItem').mockImplementation(() => {})
    const lengthSpy = vi.spyOn(window.localStorage, 'length', 'get').mockReturnValue(3)
    const keySpy = vi.spyOn(window.localStorage, 'key').mockImplementation((index: number) => {
      if (index === 0) return 'not_explanation_key'
      if (index === 1) return 'fractal_concept_explanation_hit'
      return null
    })

    const { result } = renderHook(() => useConceptExplanation())

    act(() => {
      result.current.clearAllCached()
    })

    expect(removeItemSpy).toHaveBeenCalledTimes(1)
    expect(removeItemSpy).toHaveBeenCalledWith('fractal_concept_explanation_hit')

    removeItemSpy.mockRestore()
    lengthSpy.mockRestore()
    keySpy.mockRestore()
  })
})
