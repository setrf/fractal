import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useConceptExplanation } from './useConceptExplanation'
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
})
