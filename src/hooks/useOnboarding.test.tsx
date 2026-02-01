/**
 * @fileoverview Tests for the useOnboarding hook.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useOnboarding } from './useOnboarding'

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
})
