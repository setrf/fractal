/**
 * useTheme Hook Tests
 * ===================
 * 
 * Tests for the theme management hook.
 * 
 * Test Coverage:
 * - Initial state based on system preference
 * - setTheme() function
 * - toggleTheme() function
 * - localStorage persistence
 * - Theme application to DOM
 * 
 * Note: These tests mock localStorage and matchMedia.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTheme } from './useTheme'
import { localStorageMock } from '../test/setup'

describe('useTheme Hook', () => {
  
  beforeEach(() => {
    // Clear localStorage and DOM state before each test
    localStorageMock.clear()
    document.documentElement.removeAttribute('data-theme')
  })

  // ============================================
  // Initial State Tests
  // ============================================
  describe('Initial State', () => {
    it('should default to "system" when no stored preference', () => {
      const { result } = renderHook(() => useTheme())
      
      console.log(`[TEST] Initial theme: ${result.current.theme}`)
      console.log(`[TEST] isSystem: ${result.current.isSystem}`)
      
      expect(result.current.theme).toBe('system')
      expect(result.current.isSystem).toBe(true)
    })

    it('should restore theme from localStorage', () => {
      localStorageMock.setItem('fractal-theme', 'dark')
      
      const { result } = renderHook(() => useTheme())
      
      console.log(`[TEST] Restored theme: ${result.current.theme}`)
      
      expect(result.current.theme).toBe('dark')
    })

    it('should compute effectiveTheme based on system preference', () => {
      const { result } = renderHook(() => useTheme())
      
      // Our mock returns 'light' for system preference
      console.log(`[TEST] effectiveTheme: ${result.current.effectiveTheme}`)
      
      expect(result.current.effectiveTheme).toBe('light')
    })
  })

  // ============================================
  // setTheme() Tests
  // ============================================
  describe('setTheme()', () => {
    it('should update theme to light', () => {
      const { result } = renderHook(() => useTheme())
      
      act(() => {
        result.current.setTheme('light')
      })
      
      console.log(`[TEST] Theme after setTheme('light'): ${result.current.theme}`)
      
      expect(result.current.theme).toBe('light')
      expect(result.current.effectiveTheme).toBe('light')
    })

    it('should update theme to dark', () => {
      const { result } = renderHook(() => useTheme())
      
      act(() => {
        result.current.setTheme('dark')
      })
      
      console.log(`[TEST] Theme after setTheme('dark'): ${result.current.theme}`)
      
      expect(result.current.theme).toBe('dark')
      expect(result.current.effectiveTheme).toBe('dark')
    })

    it('should update theme to system', () => {
      const { result } = renderHook(() => useTheme())
      
      // First set to dark
      act(() => {
        result.current.setTheme('dark')
      })
      
      // Then back to system
      act(() => {
        result.current.setTheme('system')
      })
      
      console.log(`[TEST] Theme after setTheme('system'): ${result.current.theme}`)
      console.log(`[TEST] isSystem: ${result.current.isSystem}`)
      
      expect(result.current.theme).toBe('system')
      expect(result.current.isSystem).toBe(true)
    })

    it('should persist theme to localStorage', () => {
      const { result } = renderHook(() => useTheme())
      
      act(() => {
        result.current.setTheme('dark')
      })
      
      const stored = localStorageMock.getItem('fractal-theme')
      
      console.log(`[TEST] Stored in localStorage: ${stored}`)
      
      expect(stored).toBe('dark')
    })

    it('should apply theme to document', () => {
      const { result } = renderHook(() => useTheme())
      
      act(() => {
        result.current.setTheme('dark')
      })
      
      const dataTheme = document.documentElement.getAttribute('data-theme')
      
      console.log(`[TEST] data-theme attribute: ${dataTheme}`)
      
      expect(dataTheme).toBe('dark')
    })

    it('should remove data-theme when set to system', () => {
      const { result } = renderHook(() => useTheme())
      
      // First set to dark
      act(() => {
        result.current.setTheme('dark')
      })
      
      // Then back to system
      act(() => {
        result.current.setTheme('system')
      })
      
      const dataTheme = document.documentElement.getAttribute('data-theme')
      
      console.log(`[TEST] data-theme after system: ${dataTheme}`)
      
      expect(dataTheme).toBeNull()
    })
  })

  // ============================================
  // toggleTheme() Tests
  // ============================================
  describe('toggleTheme()', () => {
    it('should toggle from light to dark', () => {
      const { result } = renderHook(() => useTheme())
      
      // Start with light
      act(() => {
        result.current.setTheme('light')
      })
      
      const before = result.current.effectiveTheme
      
      act(() => {
        result.current.toggleTheme()
      })
      
      const after = result.current.effectiveTheme
      
      console.log(`[TEST] Toggle: ${before} -> ${after}`)
      
      expect(before).toBe('light')
      expect(after).toBe('dark')
    })

    it('should toggle from dark to light', () => {
      const { result } = renderHook(() => useTheme())
      
      // Start with dark
      act(() => {
        result.current.setTheme('dark')
      })
      
      const before = result.current.effectiveTheme
      
      act(() => {
        result.current.toggleTheme()
      })
      
      const after = result.current.effectiveTheme
      
      console.log(`[TEST] Toggle: ${before} -> ${after}`)
      
      expect(before).toBe('dark')
      expect(after).toBe('light')
    })

    it('should persist toggled theme', () => {
      const { result } = renderHook(() => useTheme())
      
      act(() => {
        result.current.setTheme('light')
      })
      
      act(() => {
        result.current.toggleTheme()
      })
      
      const stored = localStorageMock.getItem('fractal-theme')
      
      console.log(`[TEST] Stored after toggle: ${stored}`)
      
      expect(stored).toBe('dark')
    })

    it('should toggle from system (respecting current effective theme)', () => {
      const { result } = renderHook(() => useTheme())
      
      // System preference is mocked to 'light'
      const beforeEffective = result.current.effectiveTheme
      
      act(() => {
        result.current.toggleTheme()
      })
      
      const afterEffective = result.current.effectiveTheme
      
      console.log(`[TEST] System toggle: ${beforeEffective} -> ${afterEffective}`)
      
      // Since system was 'light', toggling should give 'dark'
      expect(beforeEffective).toBe('light')
      expect(afterEffective).toBe('dark')
      // And it should no longer be in system mode
      expect(result.current.isSystem).toBe(false)
    })
  })

  // ============================================
  // Edge Cases
  // ============================================
  describe('Edge Cases', () => {
    it('should handle invalid localStorage value gracefully', () => {
      localStorageMock.setItem('fractal-theme', 'invalid-value')
      
      const { result } = renderHook(() => useTheme())
      
      console.log(`[TEST] Theme with invalid stored value: ${result.current.theme}`)
      
      // Should fall back to system
      expect(result.current.theme).toBe('system')
    })

    it('should handle rapid toggles', () => {
      const { result } = renderHook(() => useTheme())
      
      act(() => {
        result.current.setTheme('light')
      })
      
      // Rapid toggles
      act(() => {
        result.current.toggleTheme() // -> dark
        result.current.toggleTheme() // -> light
        result.current.toggleTheme() // -> dark
        result.current.toggleTheme() // -> light
        result.current.toggleTheme() // -> dark
      })
      
      console.log(`[TEST] Theme after 5 toggles: ${result.current.effectiveTheme}`)
      
      expect(result.current.effectiveTheme).toBe('dark')
    })
  })
})
