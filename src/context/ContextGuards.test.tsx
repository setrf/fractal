import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { ModelProvider, useModelContext } from './ModelContext'
import { ProbeProvider, useProbeContext } from './ProbeContext'
import { StashProvider, useStashContext } from './StashContext'
import { ViewModeProvider, useViewModeContext } from './ViewModeContext'

describe('Context guards', () => {
  it('throws when model context is used outside provider', () => {
    expect(() => renderHook(() => useModelContext())).toThrow(
      'useModelContext must be used within a ModelProvider'
    )
  })

  it('throws when probe context is used outside provider', () => {
    expect(() => renderHook(() => useProbeContext())).toThrow(
      'useProbeContext must be used within a ProbeProvider'
    )
  })

  it('throws when stash context is used outside provider', () => {
    expect(() => renderHook(() => useStashContext())).toThrow(
      'useStashContext must be used within a StashProvider'
    )
  })

  it('throws when view mode context is used outside provider', () => {
    expect(() => renderHook(() => useViewModeContext())).toThrow(
      'useViewModeContext must be used within a ViewModeProvider'
    )
  })

  it('provides context values when wrapped by providers', () => {
    const { result: modelResult } = renderHook(() => useModelContext(), {
      wrapper: ({ children }) => <ModelProvider autoLoad={false}>{children}</ModelProvider>,
    })
    expect(modelResult.current).toBeDefined()

    const { result: probeResult } = renderHook(() => useProbeContext(), {
      wrapper: ({ children }) => <ProbeProvider>{children}</ProbeProvider>,
    })
    expect(probeResult.current).toBeDefined()

    const { result: stashResult } = renderHook(() => useStashContext(), {
      wrapper: ({ children }) => <StashProvider>{children}</StashProvider>,
    })
    expect(stashResult.current).toBeDefined()

    const { result: viewResult } = renderHook(() => useViewModeContext(), {
      wrapper: ({ children }) => <ViewModeProvider>{children}</ViewModeProvider>,
    })
    expect(viewResult.current).toBeDefined()
  })
})
