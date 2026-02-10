import { act, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  GraphProvider,
  type GraphContextValue,
  useGraphContext,
} from './GraphContext'
import { DEFAULT_GRAPH_FILTERS } from '../types/graph'

const emptyTree = {
  nodes: {},
  rootId: null,
  activeId: null,
}

describe('GraphContext', () => {
  it('exposes safe no-op defaults when used outside GraphProvider', () => {
    let value: GraphContextValue | null = null

    function Reader() {
      value = useGraphContext()
      return <div>reader</div>
    }

    render(<Reader />)
    expect(value).not.toBeNull()

    expect(() => {
      value!.setFilters(DEFAULT_GRAPH_FILTERS)
      value!.toggleNodeType('question')
      value!.resetFilters()
      value!.setLinkDistanceMult(1.1)
      value!.setRepulsionMult(1.2)
      value!.setCenteringMult(1.3)
      value!.setFrictionMult(1.4)
      value!.setVisualScale(1.5)
    }).not.toThrow()
  })

  it('updates filters and force multipliers through provider callbacks', () => {
    let value: GraphContextValue | null = null

    function Reader() {
      value = useGraphContext()
      return (
        <div data-testid="graph-values">
          {String(value.filters.showQuestions)}|
          {value.linkDistanceMult}|{value.repulsionMult}|{value.centeringMult}|{value.frictionMult}|{value.visualScale}
        </div>
      )
    }

    render(
      <GraphProvider tree={emptyTree} nodeConcepts={{}} stashItems={[]} probes={[]}>
        <Reader />
      </GraphProvider>
    )

    expect(screen.getByTestId('graph-values')).toHaveTextContent('true|1|1|1|1|1')

    act(() => {
      value!.toggleNodeType('question')
    })
    expect(screen.getByTestId('graph-values')).toHaveTextContent('false|1|1|1|1|1')

    act(() => {
      value!.toggleNodeType('stash')
    })
    expect(value!.filters.showStashItems).toBe(false)

    act(() => {
      value!.setFilters({
        ...DEFAULT_GRAPH_FILTERS,
        showQuestions: false,
      })
    })
    expect(screen.getByTestId('graph-values')).toHaveTextContent('false|1|1|1|1|1')

    act(() => {
      value!.resetFilters()
      value!.setLinkDistanceMult(1.25)
      value!.setRepulsionMult(1.5)
      value!.setCenteringMult(0.75)
      value!.setFrictionMult(0.8)
      value!.setVisualScale(1.6)
    })
    expect(screen.getByTestId('graph-values')).toHaveTextContent('true|1.25|1.5|0.75|0.8|1.6')
  })
})
