/**
 * @fileoverview Onboarding state management with persistence.
 *
 * Handles first-visit auto-start, step navigation, and restart/skip flows.
 */

import { useCallback, useMemo, useState } from 'react'

export type OnboardingStatus = 'pending' | 'completed' | 'skipped'

export interface OnboardingStorage {
  version: string
  status: OnboardingStatus
  updatedAt: number
}

export interface UseOnboardingOptions {
  /** Total number of steps in the onboarding flow */
  totalSteps: number
  /** Optional storage key (for versioning/resets) */
  storageKey?: string
  /** Whether to auto-start when not completed */
  autoStart?: boolean
  /** Version string to invalidate old onboarding state */
  version?: string
}

export interface UseOnboardingReturn {
  isOpen: boolean
  currentStep: number
  totalSteps: number
  status: OnboardingStatus
  hasCompleted: boolean
  open: () => void
  close: () => void
  skip: () => void
  restart: () => void
  next: () => void
  prev: () => void
  setStep: (index: number) => void
  complete: () => void
}

const DEFAULT_STORAGE_KEY = 'fractal_onboarding_v1'
const DEFAULT_VERSION = 'v1'

export function loadOnboardingFromStorage(storageKey: string, version: string): OnboardingStorage | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return null
    const parsed = JSON.parse(raw) as OnboardingStorage
    if (!parsed || typeof parsed !== 'object') return null
    if (parsed.version !== version) return null
    if (!parsed.status) return null
    return parsed
  } catch {
    return null
  }
}

export function saveOnboardingToStorage(storageKey: string, value: OnboardingStorage) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(storageKey, JSON.stringify(value))
  } catch {
    // ignore storage failures
  }
}

export function clearOnboardingStorage(storageKey: string) {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(storageKey)
  } catch {
    // ignore storage failures
  }
}

export function useOnboarding({
  totalSteps,
  storageKey = DEFAULT_STORAGE_KEY,
  autoStart = true,
  version = DEFAULT_VERSION,
}: UseOnboardingOptions): UseOnboardingReturn {
  const stored = useMemo(() => loadOnboardingFromStorage(storageKey, version), [storageKey, version])
  const [status, setStatus] = useState<OnboardingStatus>(stored?.status || 'pending')
  const [currentStep, setCurrentStep] = useState(0)
  const [isOpen, setIsOpen] = useState(() => autoStart && (stored?.status ?? 'pending') === 'pending')

  const hasCompleted = status !== 'pending'

  const persistStatus = useCallback(
    (nextStatus: OnboardingStatus) => {
      const payload: OnboardingStorage = {
        version,
        status: nextStatus,
        updatedAt: Date.now(),
      }
      saveOnboardingToStorage(storageKey, payload)
    },
    [storageKey, version]
  )

  const open = useCallback(() => {
    setCurrentStep(0)
    setIsOpen(true)
  }, [])

  const close = useCallback(() => {
    setIsOpen(false)
  }, [])

  const skip = useCallback(() => {
    setStatus('skipped')
    persistStatus('skipped')
    setIsOpen(false)
  }, [persistStatus])

  const complete = useCallback(() => {
    setStatus('completed')
    persistStatus('completed')
    setIsOpen(false)
  }, [persistStatus])

  const restart = useCallback(() => {
    clearOnboardingStorage(storageKey)
    setStatus('pending')
    setCurrentStep(0)
    setIsOpen(true)
  }, [storageKey])

  const next = useCallback(() => {
    setCurrentStep((prev) => {
      const nextIndex = prev + 1
      if (nextIndex >= totalSteps) {
        complete()
        return prev
      }
      return nextIndex
    })
  }, [complete, totalSteps])

  const prev = useCallback(() => {
    setCurrentStep((prev) => Math.max(0, prev - 1))
  }, [])

  const setStep = useCallback((index: number) => {
    const bounded = Math.min(Math.max(index, 0), Math.max(totalSteps - 1, 0))
    setCurrentStep(bounded)
  }, [totalSteps])

  return {
    isOpen,
    currentStep,
    totalSteps,
    status,
    hasCompleted,
    open,
    close,
    skip,
    restart,
    next,
    prev,
    setStep,
    complete,
  }
}
