import { describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useGraphInteractions } from './useGraphInteractions'
import type { GraphNode } from '../types/graph'

function createNode(overrides: Partial<GraphNode> = {}): GraphNode {
  return {
    id: 'q_1',
    type: 'question',
    label: 'Why do we dream?',
    data: {
      id: 'q_1',
      text: 'Why do we dream?',
      parentId: null,
      childIds: [],
      depth: 0,
      position: { x: 0, y: 0 },
      meta: { createdAt: Date.now(), updatedAt: Date.now(), isExpanded: true },
    },
    color: '#4488dd',
    size: 1,
    group: 'q_1',
    ...overrides,
  }
}

describe('useGraphInteractions', () => {
  it('initializes popup state as closed', () => {
    const { result } = renderHook(() =>
      useGraphInteractions({
        onDeepDive: vi.fn(),
        onChat: vi.fn(),
      })
    )

    expect(result.current.graphPopupNode).toBeNull()
    expect(result.current.graphPopupPosition).toEqual({ x: 0, y: 0 })
  })

  it('opens popup with clicked node and mouse coordinates', () => {
    const { result } = renderHook(() =>
      useGraphInteractions({
        onDeepDive: vi.fn(),
        onChat: vi.fn(),
      })
    )
    const node = createNode()

    act(() => {
      result.current.handleGraphNodeClick(node, { clientX: 120, clientY: 340 } as MouseEvent)
    })

    expect(result.current.graphPopupNode).toEqual(node)
    expect(result.current.graphPopupPosition).toEqual({ x: 120, y: 340 })
  })

  it('closes popup explicitly', () => {
    const { result } = renderHook(() =>
      useGraphInteractions({
        onDeepDive: vi.fn(),
        onChat: vi.fn(),
      })
    )

    act(() => {
      result.current.handleGraphNodeClick(createNode(), { clientX: 1, clientY: 2 } as MouseEvent)
    })
    expect(result.current.graphPopupNode).not.toBeNull()

    act(() => {
      result.current.handleGraphPopupClose()
    })

    expect(result.current.graphPopupNode).toBeNull()
  })

  it('delegates deep-dive action and closes popup first', () => {
    const onDeepDive = vi.fn()
    const { result } = renderHook(() =>
      useGraphInteractions({
        onDeepDive,
        onChat: vi.fn(),
      })
    )

    act(() => {
      result.current.handleGraphNodeClick(createNode(), { clientX: 10, clientY: 20 } as MouseEvent)
    })
    expect(result.current.graphPopupNode).not.toBeNull()

    act(() => {
      result.current.handleGraphDeepDive('q_1', 'Why do we dream?')
    })

    expect(result.current.graphPopupNode).toBeNull()
    expect(onDeepDive).toHaveBeenCalledWith('q_1', 'Why do we dream?')
  })

  it('delegates chat action and closes popup first', () => {
    const onChat = vi.fn()
    const { result } = renderHook(() =>
      useGraphInteractions({
        onDeepDive: vi.fn(),
        onChat,
      })
    )

    act(() => {
      result.current.handleGraphNodeClick(createNode(), { clientX: 10, clientY: 20 } as MouseEvent)
    })
    expect(result.current.graphPopupNode).not.toBeNull()

    act(() => {
      result.current.handleGraphChat('q_1', 'Why do we dream?')
    })

    expect(result.current.graphPopupNode).toBeNull()
    expect(onChat).toHaveBeenCalledWith('q_1', 'Why do we dream?')
  })
})
