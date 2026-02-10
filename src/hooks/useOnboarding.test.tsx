/**
 * @fileoverview Tests for the useOnboarding hook.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
  clearOnboardingStorage,
  loadOnboardingFromStorage,
  saveOnboardingToStorage,
  useOnboarding,
} from './useOnboarding'

const STORAGE_KEY = 'fractal-onboarding-test'

describe('useOnboarding', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('auto-starts on first visit when enabled', () => {
    const { result } = renderHook(() =>
      useOnboarding({ totalSteps: 3, storageKey: STORAGE_KEY, autoStart: true })
    )

    expect(result.current.isOpen).toBe(true)
    expect(result.current.status).toBe('pending')
  })

  it('does not auto-start when disabled', () => {
    const { result } = renderHook(() =>
      useOnboarding({ totalSteps: 2, storageKey: STORAGE_KEY, autoStart: false })
    )

    expect(result.current.isOpen).toBe(false)
  })

  it('persists skip status and closes', () => {
    const { result } = renderHook(() =>
      useOnboarding({ totalSteps: 2, storageKey: STORAGE_KEY, autoStart: true })
    )

    act(() => {
      result.current.skip()
    })

    expect(result.current.status).toBe('skipped')
    expect(result.current.isOpen).toBe(false)

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    expect(stored.status).toBe('skipped')
  })

  it('persists completion status', () => {
    const { result } = renderHook(() =>
      useOnboarding({ totalSteps: 1, storageKey: STORAGE_KEY, autoStart: true })
    )

    act(() => {
      result.current.complete()
    })

    expect(result.current.status).toBe('completed')
    expect(result.current.isOpen).toBe(false)

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    expect(stored.status).toBe('completed')
  })

  it('restart clears storage and reopens', () => {
    const { result } = renderHook(() =>
      useOnboarding({ totalSteps: 2, storageKey: STORAGE_KEY, autoStart: true })
    )

    act(() => {
      result.current.skip()
    })

    act(() => {
      result.current.restart()
    })

    expect(result.current.status).toBe('pending')
    expect(result.current.isOpen).toBe(true)
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('loads persisted status when version matches and blocks auto-start', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 'v9',
        status: 'completed',
        updatedAt: Date.now(),
      })
    )

    const { result } = renderHook(() =>
      useOnboarding({ totalSteps: 3, storageKey: STORAGE_KEY, autoStart: true, version: 'v9' })
    )

    expect(result.current.status).toBe('completed')
    expect(result.current.hasCompleted).toBe(true)
    expect(result.current.isOpen).toBe(false)
  })

  it('ignores invalid persisted payloads and restarts from pending', () => {
    localStorage.setItem(STORAGE_KEY, '{not-json')

    const { result, rerender } = renderHook(
      ({ version }) => useOnboarding({ totalSteps: 2, storageKey: STORAGE_KEY, autoStart: true, version }),
      { initialProps: { version: 'v1' } }
    )

    expect(result.current.status).toBe('pending')
    expect(result.current.isOpen).toBe(true)

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 'old',
        status: 'skipped',
        updatedAt: Date.now(),
      })
    )

    rerender({ version: 'v2' })
    expect(result.current.status).toBe('pending')
  })

  it('ignores persisted payloads that are not objects or that lack status', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify('not-an-object'))
    const first = renderHook(() =>
      useOnboarding({ totalSteps: 2, storageKey: STORAGE_KEY, autoStart: true, version: 'v1' })
    )
    expect(first.result.current.status).toBe('pending')
    first.unmount()

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 'v1',
        updatedAt: Date.now(),
      })
    )
    const second = renderHook(() =>
      useOnboarding({ totalSteps: 2, storageKey: STORAGE_KEY, autoStart: true, version: 'v1' })
    )
    expect(second.result.current.status).toBe('pending')
    second.unmount()
  })

  it('covers no-window storage guards for load/save/clear paths', () => {
    const savedWindow = (globalThis as { window?: unknown }).window

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      writable: true,
      value: undefined,
    })

    try {
      expect(loadOnboardingFromStorage(STORAGE_KEY, 'v1')).toBeNull()
      expect(() =>
        saveOnboardingToStorage(STORAGE_KEY, {
          version: 'v1',
          status: 'completed',
          updatedAt: Date.now(),
        })
      ).not.toThrow()
      expect(() => clearOnboardingStorage(STORAGE_KEY)).not.toThrow()
    } finally {
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        writable: true,
        value: savedWindow,
      })
    }
  })

  it('supports open/close, step navigation, and clamped setStep', () => {
    const { result } = renderHook(() =>
      useOnboarding({ totalSteps: 3, storageKey: STORAGE_KEY, autoStart: false })
    )

    act(() => {
      result.current.open()
      result.current.next()
      result.current.next()
      result.current.prev()
      result.current.setStep(99)
    })

    expect(result.current.isOpen).toBe(true)
    expect(result.current.currentStep).toBe(2)

    act(() => {
      result.current.setStep(-5)
      result.current.close()
    })
    expect(result.current.currentStep).toBe(0)
    expect(result.current.isOpen).toBe(false)
  })

  it('completes automatically when advancing past the final step', () => {
    const { result } = renderHook(() =>
      useOnboarding({ totalSteps: 1, storageKey: STORAGE_KEY, autoStart: true })
    )

    act(() => {
      result.current.next()
    })

    expect(result.current.status).toBe('completed')
    expect(result.current.isOpen).toBe(false)
    expect(result.current.currentStep).toBe(0)
  })
})
