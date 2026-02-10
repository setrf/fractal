import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getStoredTheme, getSystemTheme, resolveThemeWindow, useTheme } from './useTheme'

function createMediaQueryList(matches: boolean): MediaQueryList {
  return {
    matches,
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }
}

describe('useTheme', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.documentElement.removeAttribute('data-theme')
  })

  it('falls back to system theme when stored value is invalid', () => {
    localStorage.setItem('fractal-theme', 'invalid-theme')

    const { result } = renderHook(() => useTheme())

    expect(result.current.theme).toBe('system')
    expect(result.current.isSystem).toBe(true)
    expect(document.documentElement.getAttribute('data-theme')).toBeNull()
  })

  it('falls back to system theme when localStorage read fails', () => {
    vi.spyOn(window.localStorage, 'getItem').mockImplementationOnce(() => {
      throw new Error('read failure')
    })

    const { result } = renderHook(() => useTheme())

    expect(result.current.theme).toBe('system')
    expect(result.current.effectiveTheme).toBe('light')
  })

  it('resolves dark system theme when media query matches', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue(createMediaQueryList(true))
    expect(getSystemTheme()).toBe('dark')
  })

  it('covers no-window guards for theme helper functions', () => {
    const originalWindow = window
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: undefined,
    })

    try {
      expect(resolveThemeWindow()).toBeNull()
      expect(getSystemTheme()).toBe('light')
      expect(getStoredTheme()).toBe('system')
    } finally {
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: originalWindow,
      })
    }
  })

  it('restores a valid persisted theme from localStorage', () => {
    localStorage.setItem('fractal-theme', 'dark')

    const { result } = renderHook(() => useTheme())

    expect(result.current.theme).toBe('dark')
    expect(result.current.effectiveTheme).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('applies and persists explicit themes', () => {
    const { result } = renderHook(() => useTheme())

    act(() => {
      result.current.setTheme('dark')
    })

    expect(localStorage.getItem('fractal-theme')).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(result.current.theme).toBe('dark')
    expect(result.current.effectiveTheme).toBe('dark')
  })

  it('removes data-theme attribute when switching to system mode', () => {
    const { result } = renderHook(() => useTheme())

    act(() => {
      result.current.setTheme('dark')
    })
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')

    act(() => {
      result.current.setTheme('system')
    })
    expect(document.documentElement.getAttribute('data-theme')).toBeNull()
    expect(result.current.isSystem).toBe(true)
  })

  it('ignores localStorage write errors when setting theme', () => {
    vi.spyOn(window.localStorage, 'setItem').mockImplementationOnce(() => {
      throw new Error('write failure')
    })

    const { result } = renderHook(() => useTheme())

    expect(() => {
      act(() => {
        result.current.setTheme('dark')
      })
    }).not.toThrow()

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('toggles from system/light to dark based on effective theme', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue(createMediaQueryList(false))
    const { result } = renderHook(() => useTheme())

    act(() => {
      result.current.toggleTheme()
    })

    expect(result.current.theme).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('toggles from dark to light', () => {
    localStorage.setItem('fractal-theme', 'dark')
    const { result } = renderHook(() => useTheme())

    act(() => {
      result.current.toggleTheme()
    })

    expect(result.current.theme).toBe('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('subscribes to system preference changes only in system mode', () => {
    const mediaQuery = createMediaQueryList(false)
    const matchMediaSpy = vi.spyOn(window, 'matchMedia').mockReturnValue(mediaQuery)

    const { unmount } = renderHook(() => useTheme())

    expect(matchMediaSpy).toHaveBeenCalled()
    expect(mediaQuery.addEventListener).toHaveBeenCalledWith('change', expect.any(Function))

    unmount()
    expect(mediaQuery.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function))
  })

  it('reapplies system theme when the media query change callback fires', () => {
    const mediaQuery = createMediaQueryList(false)
    let changeHandler: (() => void) | null = null

    vi.spyOn(mediaQuery, 'addEventListener').mockImplementation((event, handler) => {
      if (event === 'change') {
        changeHandler = handler as () => void
      }
    })

    vi.spyOn(window, 'matchMedia').mockReturnValue(mediaQuery)
    const { result, rerender } = renderHook(() => useTheme())

    expect(document.documentElement.getAttribute('data-theme')).toBeNull()
    expect(result.current.effectiveTheme).toBe('light')

    mediaQuery.matches = true
    act(() => {
      changeHandler?.()
      rerender()
    })

    expect(document.documentElement.getAttribute('data-theme')).toBeNull()
    expect(result.current.effectiveTheme).toBe('dark')
  })

  it('does not subscribe to system changes when an explicit theme is selected', () => {
    localStorage.setItem('fractal-theme', 'dark')
    const mediaQuery = createMediaQueryList(false)
    vi.spyOn(window, 'matchMedia').mockReturnValue(mediaQuery)

    renderHook(() => useTheme())

    expect(mediaQuery.addEventListener).not.toHaveBeenCalled()
  })
})
