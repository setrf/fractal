/**
 * useViewMode Hook Tests
 * =======================
 *
 * Tests for the view mode management hook (traditional vs graph view).
 *
 * Test Coverage:
 * - Initial state defaults to 'traditional'
 * - setViewMode() function
 * - toggleViewMode() function
 * - localStorage persistence
 * - View mode application to DOM
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useViewMode } from './useViewMode'
import { localStorageMock } from '../test/setup'

describe('useViewMode Hook', () => {
  beforeEach(() => {
    // Clear localStorage and DOM state before each test
    localStorageMock.clear()
    document.documentElement.removeAttribute('data-view-mode')
  })

  // ============================================
  // Initial State Tests
  // ============================================
  describe('Initial State', () => {
    it('should default to "traditional" when no stored preference', () => {
      const { result } = renderHook(() => useViewMode())

      console.log(`[TEST] Initial viewMode: ${result.current.viewMode}`)
      console.log(`[TEST] isGraphView: ${result.current.isGraphView}`)

      expect(result.current.viewMode).toBe('traditional')
      expect(result.current.isGraphView).toBe(false)
    })

    it('should restore view mode from localStorage', () => {
      localStorageMock.setItem('fractal-view-mode', 'graph')

      const { result } = renderHook(() => useViewMode())

      console.log(`[TEST] Restored viewMode: ${result.current.viewMode}`)

      expect(result.current.viewMode).toBe('graph')
      expect(result.current.isGraphView).toBe(true)
    })
  })

  // ============================================
  // setViewMode() Tests
  // ============================================
  describe('setViewMode()', () => {
    it('should update view mode to graph', () => {
      const { result } = renderHook(() => useViewMode())

      act(() => {
        result.current.setViewMode('graph')
      })

      console.log(`[TEST] View mode after setViewMode('graph'): ${result.current.viewMode}`)

      expect(result.current.viewMode).toBe('graph')
      expect(result.current.isGraphView).toBe(true)
    })

    it('should update view mode to traditional', () => {
      const { result } = renderHook(() => useViewMode())

      // First set to graph
      act(() => {
        result.current.setViewMode('graph')
      })

      // Then back to traditional
      act(() => {
        result.current.setViewMode('traditional')
      })

      console.log(`[TEST] View mode after setViewMode('traditional'): ${result.current.viewMode}`)

      expect(result.current.viewMode).toBe('traditional')
      expect(result.current.isGraphView).toBe(false)
    })

    it('should persist view mode to localStorage', () => {
      const { result } = renderHook(() => useViewMode())

      act(() => {
        result.current.setViewMode('graph')
      })

      const stored = localStorageMock.getItem('fractal-view-mode')

      console.log(`[TEST] Stored in localStorage: ${stored}`)

      expect(stored).toBe('graph')
    })

    it('should apply view mode to document', () => {
      const { result } = renderHook(() => useViewMode())

      act(() => {
        result.current.setViewMode('graph')
      })

      const dataViewMode = document.documentElement.getAttribute('data-view-mode')

      console.log(`[TEST] data-view-mode attribute: ${dataViewMode}`)

      expect(dataViewMode).toBe('graph')
    })
  })

  // ============================================
  // toggleViewMode() Tests
  // ============================================
  describe('toggleViewMode()', () => {
    it('should toggle from traditional to graph', () => {
      const { result } = renderHook(() => useViewMode())

      const before = result.current.viewMode

      act(() => {
        result.current.toggleViewMode()
      })

      const after = result.current.viewMode

      console.log(`[TEST] Toggle: ${before} -> ${after}`)

      expect(before).toBe('traditional')
      expect(after).toBe('graph')
    })

    it('should toggle from graph to traditional', () => {
      const { result } = renderHook(() => useViewMode())

      // Start with graph
      act(() => {
        result.current.setViewMode('graph')
      })

      const before = result.current.viewMode

      act(() => {
        result.current.toggleViewMode()
      })

      const after = result.current.viewMode

      console.log(`[TEST] Toggle: ${before} -> ${after}`)

      expect(before).toBe('graph')
      expect(after).toBe('traditional')
    })

    it('should persist toggled view mode', () => {
      const { result } = renderHook(() => useViewMode())

      act(() => {
        result.current.toggleViewMode()
      })

      const stored = localStorageMock.getItem('fractal-view-mode')

      console.log(`[TEST] Stored after toggle: ${stored}`)

      expect(stored).toBe('graph')
    })
  })

  // ============================================
  // Edge Cases
  // ============================================
  describe('Edge Cases', () => {
    it('should handle invalid localStorage value gracefully', () => {
      localStorageMock.setItem('fractal-view-mode', 'invalid-value')

      const { result } = renderHook(() => useViewMode())

      console.log(`[TEST] View mode with invalid stored value: ${result.current.viewMode}`)

      // Should fall back to traditional
      expect(result.current.viewMode).toBe('traditional')
    })

    it('should handle rapid toggles', () => {
      const { result } = renderHook(() => useViewMode())

      // Rapid toggles
      act(() => {
        result.current.toggleViewMode() // -> graph
        result.current.toggleViewMode() // -> traditional
        result.current.toggleViewMode() // -> graph
        result.current.toggleViewMode() // -> traditional
        result.current.toggleViewMode() // -> graph
      })

      console.log(`[TEST] View mode after 5 toggles: ${result.current.viewMode}`)

      expect(result.current.viewMode).toBe('graph')
    })
  })
})
