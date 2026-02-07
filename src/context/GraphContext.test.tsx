import { fireEvent, render, renderHook, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  GraphProvider,
  useGraphContext,
} from './GraphContext'
import { createEmptyTree } from '../types/question'
import type { UseGraphDataReturn } from '../hooks/useGraphData'

const mockUseGraphData = vi.fn()

vi.mock('../hooks/useGraphData', () => ({
  useGraphData: (input: unknown) => mockUseGraphData(input),
}))

function Consumer() {
  const ctx = useGraphContext()
  return (
    <div>
      <div data-testid="filters">{JSON.stringify(ctx.filters)}</div>
      <div data-testid="distance">{ctx.linkDistanceMult}</div>
      <div data-testid="repulsion">{ctx.repulsionMult}</div>
      <div data-testid="nodes">{ctx.nodes.length}</div>
      <button onClick={() => ctx.toggleNodeType('question')}>Toggle Question</button>
      <button onClick={() => ctx.toggleNodeType('stash')}>Toggle Stash</button>
      <button onClick={ctx.resetFilters}>Reset Filters</button>
      <button onClick={() => ctx.setLinkDistanceMult(1.8)}>Set Distance</button>
      <button onClick={() => ctx.setRepulsionMult(2.2)}>Set Repulsion</button>
    </div>
  )
}

describe('GraphContext', () => {
  beforeEach(() => {
    const value: UseGraphDataReturn = {
      nodes: [
        {
          id: 'q_1',
          type: 'question',
          label: 'Q1',
          data: {
            id: 'q_1',
            text: 'Q1',
            parentId: null,
            childIds: [],
            position: { x: 0, y: 0 },
            meta: {
              createdAt: Date.now(),
              isExpanded: true,
              isActive: false,
              qualityScore: null,
            },
          },
          color: '#4488dd',
          size: 1,
          group: 'q_1',
        },
      ],
      edges: [],
      graphData: {
        nodes: [
          {
            id: 'q_1',
            type: 'question',
            label: 'Q1',
            data: {
              id: 'q_1',
              text: 'Q1',
              parentId: null,
              childIds: [],
              position: { x: 0, y: 0 },
              meta: {
                createdAt: Date.now(),
                isExpanded: true,
                isActive: false,
                qualityScore: null,
              },
            },
            color: '#4488dd',
            size: 1,
            group: 'q_1',
          },
        ],
        edges: [],
      },
      isLoading: false,
      counts: {
        question: 1,
        concept: 0,
        stash: 0,
        probe: 0,
      },
    }
    mockUseGraphData.mockReturnValue(value)
  })

  it('returns default context values when used outside provider', () => {
    const { result } = renderHook(() => useGraphContext())

    expect(result.current.nodes).toEqual([])
    expect(result.current.counts).toEqual({ question: 0, concept: 0, stash: 0, probe: 0 })
    expect(result.current.filters.showQuestions).toBe(true)
    expect(result.current.linkDistanceMult).toBe(1)
  })

  it('provides graph data from useGraphData through GraphProvider', () => {
    render(
      <GraphProvider
        tree={createEmptyTree()}
        nodeConcepts={{}}
        stashItems={[]}
        probes={[]}
      >
        <Consumer />
      </GraphProvider>
    )

    expect(screen.getByTestId('nodes')).toHaveTextContent('1')
    expect(mockUseGraphData).toHaveBeenCalledTimes(1)
  })

  it('toggles filters including stash special-case key and resets to defaults', () => {
    render(
      <GraphProvider
        tree={createEmptyTree()}
        nodeConcepts={{}}
        stashItems={[]}
        probes={[]}
      >
        <Consumer />
      </GraphProvider>
    )

    expect(screen.getByTestId('filters')).toHaveTextContent('"showQuestions":true')
    expect(screen.getByTestId('filters')).toHaveTextContent('"showStashItems":true')

    fireEvent.click(screen.getByRole('button', { name: 'Toggle Question' }))
    fireEvent.click(screen.getByRole('button', { name: 'Toggle Stash' }))
    expect(screen.getByTestId('filters')).toHaveTextContent('"showQuestions":false')
    expect(screen.getByTestId('filters')).toHaveTextContent('"showStashItems":false')

    fireEvent.click(screen.getByRole('button', { name: 'Reset Filters' }))
    expect(screen.getByTestId('filters')).toHaveTextContent('"showQuestions":true')
    expect(screen.getByTestId('filters')).toHaveTextContent('"showStashItems":true')
  })

  it('updates dynamics multipliers through context setters', () => {
    render(
      <GraphProvider
        tree={createEmptyTree()}
        nodeConcepts={{}}
        stashItems={[]}
        probes={[]}
      >
        <Consumer />
      </GraphProvider>
    )

    expect(screen.getByTestId('distance')).toHaveTextContent('1')
    expect(screen.getByTestId('repulsion')).toHaveTextContent('1')

    fireEvent.click(screen.getByRole('button', { name: 'Set Distance' }))
    fireEvent.click(screen.getByRole('button', { name: 'Set Repulsion' }))

    expect(screen.getByTestId('distance')).toHaveTextContent('1.8')
    expect(screen.getByTestId('repulsion')).toHaveTextContent('2.2')
  })
})
