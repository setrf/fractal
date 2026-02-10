import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getStoredViewMode, resolveViewModeStorage, useViewMode } from './useViewMode'
import { GRAPH_VIEW_STORAGE_KEY } from '../types/graph'

describe('useViewMode', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-view-mode')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.documentElement.removeAttribute('data-view-mode')
  })

  it('falls back to default mode when stored value is invalid', () => {
    localStorage.setItem(GRAPH_VIEW_STORAGE_KEY, 'invalid-mode')

    const { result } = renderHook(() => useViewMode())

    expect(result.current.viewMode).toBe('traditional')
    expect(result.current.isGraphView).toBe(false)
    expect(document.documentElement.getAttribute('data-view-mode')).toBe('traditional')
  })

  it('falls back to default mode when localStorage read fails', () => {
    vi.spyOn(window.localStorage, 'getItem').mockImplementationOnce(() => {
      throw new Error('read failure')
    })

    const { result } = renderHook(() => useViewMode())

    expect(result.current.viewMode).toBe('traditional')
  })

  it('covers no-window storage fallback helper path', () => {
    const originalWindow = window
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: undefined,
    })

    try {
      expect(resolveViewModeStorage()).toBeNull()
      expect(getStoredViewMode()).toBe('traditional')
    } finally {
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: originalWindow,
      })
    }
  })

  it('restores a valid persisted graph mode', () => {
    localStorage.setItem(GRAPH_VIEW_STORAGE_KEY, 'graph')

    const { result } = renderHook(() => useViewMode())

    expect(result.current.viewMode).toBe('graph')
    expect(result.current.isGraphView).toBe(true)
    expect(document.documentElement.getAttribute('data-view-mode')).toBe('graph')
  })

  it('sets and persists view mode', () => {
    const { result } = renderHook(() => useViewMode())

    act(() => {
      result.current.setViewMode('graph')
    })

    expect(localStorage.getItem(GRAPH_VIEW_STORAGE_KEY)).toBe('graph')
    expect(document.documentElement.getAttribute('data-view-mode')).toBe('graph')
    expect(result.current.isGraphView).toBe(true)
  })

  it('sets traditional mode explicitly', () => {
    localStorage.setItem(GRAPH_VIEW_STORAGE_KEY, 'graph')
    const { result } = renderHook(() => useViewMode())

    act(() => {
      result.current.setViewMode('traditional')
    })

    expect(result.current.viewMode).toBe('traditional')
    expect(result.current.isGraphView).toBe(false)
    expect(document.documentElement.getAttribute('data-view-mode')).toBe('traditional')
  })

  it('ignores localStorage write errors when setting mode', () => {
    vi.spyOn(window.localStorage, 'setItem').mockImplementationOnce(() => {
      throw new Error('write failure')
    })

    const { result } = renderHook(() => useViewMode())

    expect(() => {
      act(() => {
        result.current.setViewMode('graph')
      })
    }).not.toThrow()

    expect(document.documentElement.getAttribute('data-view-mode')).toBe('graph')
  })

  it('toggles between traditional and graph', () => {
    const { result } = renderHook(() => useViewMode())

    act(() => {
      result.current.toggleViewMode()
    })
    expect(result.current.viewMode).toBe('graph')

    act(() => {
      result.current.toggleViewMode()
    })
    expect(result.current.viewMode).toBe('traditional')
    expect(result.current.isGraphView).toBe(false)
  })
})
