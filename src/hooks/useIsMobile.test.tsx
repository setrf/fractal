import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  MOBILE_BREAKPOINT,
  computeIsMobile,
  getInitialIsMobile,
  resolveMobileWindow,
  useIsMobile,
} from './useIsMobile'

describe('useIsMobile', () => {
  it('computes mobile state from width', () => {
    expect(computeIsMobile(MOBILE_BREAKPOINT)).toBe(true)
    expect(computeIsMobile(MOBILE_BREAKPOINT + 1)).toBe(false)
  })

  it('resolves initial mobile state from provided window values', () => {
    expect(getInitialIsMobile({ innerWidth: MOBILE_BREAKPOINT - 1 })).toBe(true)
    expect(getInitialIsMobile({ innerWidth: MOBILE_BREAKPOINT + 20 })).toBe(false)
    expect(getInitialIsMobile(null)).toBe(false)
  })

  it('returns window when available and null when unavailable', () => {
    expect(resolveMobileWindow()).toBe(window)

    const originalWindow = window
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: undefined,
    })

    try {
      expect(resolveMobileWindow()).toBeNull()
      expect(getInitialIsMobile()).toBe(false)
    } finally {
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: originalWindow,
      })
    }
  })

  it('updates when the viewport resizes', () => {
    const originalWidth = window.innerWidth
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: MOBILE_BREAKPOINT + 200,
    })

    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)

    act(() => {
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        value: MOBILE_BREAKPOINT - 10,
      })
      window.dispatchEvent(new Event('resize'))
    })

    expect(result.current).toBe(true)

    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: originalWidth,
    })
  })

})
