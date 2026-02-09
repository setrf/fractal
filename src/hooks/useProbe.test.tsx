import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useProbe } from './useProbe'
import { MAX_PROBES, PROBE_STORAGE_KEY, type Probe } from '../types/probe'
import type { StashItem } from '../types/stash'

function makeProbe(overrides: Partial<Probe> = {}): Probe {
  const timestamp = Date.now()
  return {
    id: overrides.id ?? `p_${timestamp}_${Math.random().toString(36).slice(2, 9)}`,
    name: overrides.name ?? 'Probe 1',
    color: overrides.color ?? 'blue',
    messages: overrides.messages ?? [],
    selectedStashItemIds: overrides.selectedStashItemIds ?? [],
    createdAt: overrides.createdAt ?? timestamp,
    updatedAt: overrides.updatedAt ?? timestamp,
  }
}

describe('useProbe', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('initializes with empty state by default', () => {
    const { result } = renderHook(() => useProbe())

    expect(result.current.probes).toEqual([])
    expect(result.current.activeProbe).toBeNull()
    expect(result.current.activeProbeId).toBeNull()
    expect(result.current.count).toBe(0)
    expect(result.current.canCreateProbe).toBe(true)
    expect(result.current.isOpen).toBe(false)
  })

  it('loads probes from localStorage and picks first as active', () => {
    const loaded = [
      makeProbe({ id: 'p_1', name: 'First', color: 'blue' }),
      makeProbe({ id: 'p_2', name: 'Second', color: 'green' }),
    ]
    localStorage.setItem(PROBE_STORAGE_KEY, JSON.stringify(loaded))

    const { result } = renderHook(() => useProbe())

    expect(result.current.count).toBe(2)
    expect(result.current.activeProbeId).toBe('p_1')
    expect(result.current.activeProbe?.name).toBe('First')
  })

  it('creates probes with unique colors and updates active probe', () => {
    const { result } = renderHook(() => useProbe())

    act(() => {
      result.current.createProbe()
    })
    act(() => {
      result.current.createProbe()
    })

    expect(result.current.count).toBe(2)
    expect(result.current.probes[0].color).toBe('green')
    expect(result.current.probes[1].color).toBe('blue')
    expect(result.current.activeProbeId).toBe(result.current.probes[0].id)
  })

  it('does not create probes when max limit is reached', () => {
    const seeded: Probe[] = [
      makeProbe({ id: 'p_1', color: 'blue' }),
      makeProbe({ id: 'p_2', color: 'green' }),
      makeProbe({ id: 'p_3', color: 'yellow' }),
      makeProbe({ id: 'p_4', color: 'purple' }),
      makeProbe({ id: 'p_5', color: 'orange' }),
    ]
    localStorage.setItem(PROBE_STORAGE_KEY, JSON.stringify(seeded))

    const { result } = renderHook(() => useProbe())
    let created: Probe | null = null

    act(() => {
      created = result.current.createProbe()
    })

    expect(result.current.count).toBe(MAX_PROBES)
    expect(result.current.canCreateProbe).toBe(false)
    expect(created).toBeNull()
  })

  it('renames and deletes probes while maintaining active state', () => {
    const loaded = [
      makeProbe({ id: 'p_1', name: 'Primary', color: 'blue' }),
      makeProbe({ id: 'p_2', name: 'Secondary', color: 'green' }),
    ]
    localStorage.setItem(PROBE_STORAGE_KEY, JSON.stringify(loaded))

    const { result } = renderHook(() => useProbe())

    act(() => {
      result.current.renameProbe('p_1', 'Renamed Primary')
    })
    expect(result.current.probes.find(p => p.id === 'p_1')?.name).toBe('Renamed Primary')

    act(() => {
      result.current.deleteProbe('p_1')
    })
    expect(result.current.activeProbeId).toBe('p_2')
    expect(result.current.count).toBe(1)

    act(() => {
      result.current.deleteProbe('p_2')
    })
    expect(result.current.count).toBe(0)
    expect(result.current.activeProbeId).toBeNull()
  })

  it('supports adding, updating, and clearing messages', () => {
    const { result } = renderHook(() => useProbe())

    let probeId = ''
    act(() => {
      probeId = result.current.createProbe()!.id
    })

    act(() => {
      result.current.addMessage(probeId, { role: 'user', content: 'hello' })
    })
    expect(result.current.activeProbe?.messages).toHaveLength(1)
    expect(result.current.activeProbe?.messages[0].role).toBe('user')
    expect(result.current.activeProbe?.messages[0].id.startsWith('pm_')).toBe(true)

    act(() => {
      result.current.updateLastMessage(probeId, 'updated response')
    })
    expect(result.current.activeProbe?.messages[0].content).toBe('updated response')

    act(() => {
      result.current.clearMessages(probeId)
    })
    expect(result.current.activeProbe?.messages).toEqual([])
  })

  it('manages stash item selection operations', () => {
    const { result } = renderHook(() => useProbe())

    let probeId = ''
    act(() => {
      probeId = result.current.createProbe()!.id
    })

    act(() => {
      result.current.selectStashItems(probeId, ['s_1', 's_2'])
    })
    expect(result.current.isStashItemSelectedForProbe(probeId, 's_1')).toBe(true)
    expect(result.current.isStashItemSelectedForProbe(probeId, 's_missing')).toBe(false)

    act(() => {
      result.current.addStashItemToProbe(probeId, 's_3')
      result.current.addStashItemToProbe(probeId, 's_3') // duplicate add should be ignored
    })
    expect(result.current.activeProbe?.selectedStashItemIds).toEqual(['s_1', 's_2', 's_3'])

    act(() => {
      result.current.removeStashItemFromProbe(probeId, 's_2')
    })
    expect(result.current.activeProbe?.selectedStashItemIds).toEqual(['s_1', 's_3'])

    act(() => {
      result.current.toggleStashItemForProbe(probeId, 's_3') // off
      result.current.toggleStashItemForProbe(probeId, 's_4') // on
    })
    expect(result.current.activeProbe?.selectedStashItemIds).toEqual(['s_1', 's_4'])
    expect(result.current.getProbesForStashItem('s_4').map(p => p.id)).toEqual([probeId])
  })

  it('synthesizes prompts from selected stash items with all sections', () => {
    const { result } = renderHook(() => useProbe())

    let probeId = ''
    act(() => {
      probeId = result.current.createProbe()!.id
      result.current.selectStashItems(probeId, ['h1', 'e1', 'q1', 'n1', 'c1'])
    })

    const longChat = 'x'.repeat(220)
    const stashItems: StashItem[] = [
      {
        id: 'h1',
        type: 'highlight',
        content: 'Cognitive load',
        metadata: { sourceQuestion: 'Why do we learn?' },
        createdAt: Date.now(),
      },
      {
        id: 'e1',
        type: 'explanation',
        content: 'Metacognition',
        metadata: { summary: 'Thinking about thinking' },
        createdAt: Date.now(),
      },
      {
        id: 'q1',
        type: 'question',
        content: 'How does memory consolidation work?',
        metadata: {},
        createdAt: Date.now(),
      },
      {
        id: 'n1',
        type: 'note',
        content: 'Sleep appears crucial for synthesis.',
        metadata: { title: 'Observation' },
        createdAt: Date.now(),
      },
      {
        id: 'c1',
        type: 'chat-message',
        content: longChat,
        metadata: { role: 'assistant' },
        createdAt: Date.now(),
      },
    ]

    const prompt = result.current.synthesizePrompt(probeId, stashItems, 'Build a plan')

    expect(prompt).toContain('## Context from your exploration:')
    expect(prompt).toContain('### Key Concepts')
    expect(prompt).toContain('### Explanations')
    expect(prompt).toContain('### Questions Explored')
    expect(prompt).toContain('### Your Notes')
    expect(prompt).toContain('### Relevant Chat Excerpts')
    expect(prompt).toContain('Build a plan')
    expect(prompt).toContain('...')
  })

  it('returns user direction when probe is missing or no items are selected', () => {
    const { result } = renderHook(() => useProbe())

    expect(result.current.synthesizePrompt('missing', [], 'Direction only')).toBe('Direction only')

    let probeId = ''
    act(() => {
      probeId = result.current.createProbe()!.id
    })

    expect(result.current.synthesizePrompt(probeId, [], 'Direction only')).toBe('Direction only')
  })

  it('persists probe updates after debounce interval', () => {
    vi.useFakeTimers()

    const { result } = renderHook(() => useProbe())
    act(() => {
      vi.runOnlyPendingTimers()
    })

    act(() => {
      result.current.createProbe()
    })

    expect(localStorage.getItem(PROBE_STORAGE_KEY)).toBe('[]')

    act(() => {
      vi.advanceTimersByTime(500)
    })

    const saved = JSON.parse(localStorage.getItem(PROBE_STORAGE_KEY) || '[]')
    expect(saved).toHaveLength(1)
  })

  it('supports sidebar and drag-hover UI state controls', () => {
    const { result } = renderHook(() => useProbe())

    expect(result.current.isOpen).toBe(false)
    act(() => {
      result.current.toggleOpen()
    })
    expect(result.current.isOpen).toBe(true)

    act(() => {
      result.current.setIsOpen(false)
      result.current.setSidebarWidth(512)
      result.current.setExternalDragHover(true)
    })

    expect(result.current.isOpen).toBe(false)
    expect(result.current.sidebarWidth).toBe(512)
    expect(result.current.externalDragHover).toBe(true)
  })

  it('handles localStorage load and save failures gracefully', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    const getItemSpy = vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('load failure')
    })
    const { result, unmount } = renderHook(() => useProbe())
    expect(result.current.probes).toEqual([])
    expect(consoleError).toHaveBeenCalledWith(
      '[useProbe] Failed to load from localStorage:',
      expect.any(Error)
    )
    getItemSpy.mockRestore()
    consoleError.mockClear()

    vi.useFakeTimers()
    const setItemSpy = vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('save failure')
    })
    act(() => {
      result.current.createProbe()
    })
    act(() => {
      vi.runOnlyPendingTimers()
    })
    expect(consoleError).toHaveBeenCalledWith(
      '[useProbe] Failed to save to localStorage:',
      expect.any(Error)
    )

    setItemSpy.mockRestore()
    consoleError.mockRestore()
    unmount()
  })
})
