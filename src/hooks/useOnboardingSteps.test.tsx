import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useOnboardingSteps } from './useOnboardingSteps'

function createInput(overrides: Partial<Parameters<typeof useOnboardingSteps>[0]> = {}) {
  return {
    hasRootNode: false,
    rootChildCount: 0,
    rootConceptCount: 0,
    hasLastMeta: false,
    hasPopup: false,
    stashCount: 0,
    stashOpen: false,
    probeCount: 0,
    activeProbeSelectedCount: 0,
    activeProbeMessageCount: 0,
    isGraphView: false,
    setStashOpen: vi.fn(),
    setProbeOpen: vi.fn(),
    ...overrides,
  }
}

describe('useOnboardingSteps', () => {
  it('returns the full onboarding flow in a stable order', () => {
    const { result } = renderHook(() => useOnboardingSteps(createInput()))

    expect(result.current.map((step) => step.id)).toEqual([
      'welcome',
      'seed-question',
      'deep-dive',
      'weave-score',
      'concept-highlights',
      'concept-popups',
      'stash-item',
      'stash-sidebar',
      'probe-create',
      'probe-select',
      'probe-synthesize',
      'model-selection',
      'graph-view',
      'finish',
    ])
  })

  it('computes canProceed gates from state flags', () => {
    const blocked = renderHook(() => useOnboardingSteps(createInput()))
    const blockedById = Object.fromEntries(blocked.result.current.map((step) => [step.id, step]))

    expect(blockedById['seed-question'].canProceed?.()).toBe(false)
    expect(blockedById['deep-dive'].canProceed?.()).toBe(false)
    expect(blockedById['weave-score'].canProceed?.()).toBe(false)
    expect(blockedById['concept-highlights'].canProceed?.()).toBe(false)
    expect(blockedById['concept-popups'].canProceed?.()).toBe(false)
    expect(blockedById['stash-item'].canProceed?.()).toBe(false)
    expect(blockedById['stash-sidebar'].canProceed?.()).toBe(false)
    expect(blockedById['probe-create'].canProceed?.()).toBe(false)
    expect(blockedById['probe-select'].canProceed?.()).toBe(false)
    expect(blockedById['probe-synthesize'].canProceed?.()).toBe(false)
    expect(blockedById['graph-view'].canProceed?.()).toBe(false)

    const open = renderHook(() =>
      useOnboardingSteps(
        createInput({
          hasRootNode: true,
          rootChildCount: 1,
          hasLastMeta: true,
          rootConceptCount: 1,
          hasPopup: true,
          stashCount: 1,
          stashOpen: true,
          probeCount: 1,
          activeProbeSelectedCount: 1,
          activeProbeMessageCount: 1,
          isGraphView: true,
        })
      )
    )
    const openById = Object.fromEntries(open.result.current.map((step) => [step.id, step]))

    expect(openById['seed-question'].canProceed?.()).toBe(true)
    expect(openById['deep-dive'].canProceed?.()).toBe(true)
    expect(openById['weave-score'].canProceed?.()).toBe(true)
    expect(openById['concept-highlights'].canProceed?.()).toBe(true)
    expect(openById['concept-popups'].canProceed?.()).toBe(true)
    expect(openById['stash-item'].canProceed?.()).toBe(true)
    expect(openById['stash-sidebar'].canProceed?.()).toBe(true)
    expect(openById['probe-create'].canProceed?.()).toBe(true)
    expect(openById['probe-select'].canProceed?.()).toBe(true)
    expect(openById['probe-synthesize'].canProceed?.()).toBe(true)
    expect(openById['graph-view'].canProceed?.()).toBe(true)
  })

  it('runs onEnter handlers for stash and probe steps', () => {
    const setStashOpen = vi.fn()
    const setProbeOpen = vi.fn()
    const { result } = renderHook(() =>
      useOnboardingSteps(createInput({ setStashOpen, setProbeOpen }))
    )

    const byId = Object.fromEntries(result.current.map((step) => [step.id, step]))

    byId['stash-sidebar'].onEnter?.()
    byId['probe-create'].onEnter?.()
    byId['probe-select'].onEnter?.()
    byId['probe-synthesize'].onEnter?.()

    expect(setStashOpen).toHaveBeenCalledWith(true)
    expect(setStashOpen).toHaveBeenCalledTimes(2)
    expect(setProbeOpen).toHaveBeenCalledWith(true)
    expect(setProbeOpen).toHaveBeenCalledTimes(2)
  })

  it('marks seed and deep-dive as auto-advance steps', () => {
    const { result } = renderHook(() => useOnboardingSteps(createInput()))
    const byId = Object.fromEntries(result.current.map((step) => [step.id, step]))

    expect(byId['seed-question'].autoAdvance).toBe(true)
    expect(byId['deep-dive'].autoAdvance).toBe(true)
    expect(byId['weave-score'].autoAdvance).toBeUndefined()
  })
})
