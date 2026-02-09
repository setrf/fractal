/**
 * @fileoverview Tests for the useModelSelection hook.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useModelSelection } from './useModelSelection'
import * as api from '../api'

vi.mock('../api', () => ({
  listModels: vi.fn(),
}))

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('useModelSelection Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should load models and keep stored selection when available', async () => {
    localStorage.setItem('fractal_selected_model', 'model-a')
    vi.mocked(api.listModels).mockResolvedValue(['model-a', 'model-b'])

    const { result } = renderHook(() => useModelSelection())

    await waitFor(() => {
      expect(result.current.models).toEqual(['model-a', 'model-b'])
    })

    expect(result.current.selectedModel).toBe('model-a')
  })

  it('should reset selection if stored model is unavailable', async () => {
    localStorage.setItem('fractal_selected_model', 'missing-model')
    vi.mocked(api.listModels).mockResolvedValue(['model-a'])

    const { result } = renderHook(() => useModelSelection())

    await waitFor(() => {
      expect(result.current.models).toEqual(['model-a'])
    })

    expect(result.current.selectedModel).toBeNull()
  })

  it('should persist model selection changes', async () => {
    vi.mocked(api.listModels).mockResolvedValue(['model-a'])

    const { result } = renderHook(() => useModelSelection())

    await waitFor(() => {
      expect(result.current.models).toEqual(['model-a'])
    })

    act(() => {
      result.current.setSelectedModel('model-a')
    })

    expect(localStorage.getItem('fractal_selected_model')).toBe('model-a')
  })

  it('should ignore stale refresh responses from older requests', async () => {
    const firstRequest = createDeferred<string[]>()
    const secondRequest = createDeferred<string[]>()
    vi.mocked(api.listModels)
      .mockImplementationOnce(() => firstRequest.promise)
      .mockImplementationOnce(() => secondRequest.promise)

    const { result } = renderHook(() => useModelSelection({ autoLoad: false }))

    let firstRefresh: Promise<void> = Promise.resolve()
    let secondRefresh: Promise<void> = Promise.resolve()

    await act(async () => {
      firstRefresh = result.current.refreshModels()
      secondRefresh = result.current.refreshModels()
    })

    await act(async () => {
      secondRequest.resolve(['model-new'])
      await secondRefresh
    })

    await act(async () => {
      firstRequest.resolve(['model-old'])
      await firstRefresh
    })

    expect(result.current.models).toEqual(['model-new'])
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('returns null when reading stored model throws', () => {
    const getItemSpy = vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('storage read failed')
    })

    const { result } = renderHook(() => useModelSelection({ autoLoad: false }))
    expect(result.current.selectedModel).toBeNull()

    getItemSpy.mockRestore()
  })

  it('ignores stale errors from older refresh requests', async () => {
    const firstRequest = createDeferred<string[]>()
    const secondRequest = createDeferred<string[]>()
    vi.mocked(api.listModels)
      .mockImplementationOnce(() => firstRequest.promise)
      .mockImplementationOnce(() => secondRequest.promise)

    const { result } = renderHook(() => useModelSelection({ autoLoad: false }))

    let firstRefresh: Promise<void> = Promise.resolve()
    let secondRefresh: Promise<void> = Promise.resolve()

    await act(async () => {
      firstRefresh = result.current.refreshModels()
      secondRefresh = result.current.refreshModels()
    })

    await act(async () => {
      secondRequest.resolve(['model-b'])
      await secondRefresh
    })

    await act(async () => {
      firstRequest.reject(new Error('stale failure'))
      await firstRefresh
    })

    expect(result.current.models).toEqual(['model-b'])
    expect(result.current.error).toBeNull()
    expect(result.current.isLoading).toBe(false)
  })
})
