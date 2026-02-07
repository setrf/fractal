import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useConceptExtraction } from './useConceptExtraction'
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
})
