import React, { createRef } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { GraphView, type GraphViewHandle } from './GraphView'
import type { GraphData, GraphEdge } from '../../types/graph'

const fgHarness = vi.hoisted(() => ({
  zoomToFit: vi.fn(),
  cameraPosition: vi.fn(),
  chargeStrength: vi.fn(),
  centerStrength: vi.fn(),
  nodeColors: [] as string[],
  nodeLabels: [] as string[],
  nodeObjects: [] as unknown[],
  linkColors: [] as string[],
  linkWidths: [] as number[],
  linkDistances: [] as number[],
  linkStrengths: [] as number[],
  cameraPos: { x: 10, y: 0, z: 0 },
}))

let graphContext: any
let isMobile = false

vi.mock('../../context/GraphContext', () => ({
  useGraphContext: () => graphContext,
}))

vi.mock('../../hooks/useIsMobile', () => ({
  useIsMobile: () => isMobile,
}))

vi.mock('three-spritetext', () => ({
  default: class SpriteTextMock {
    text: string
    color = ''
    fontFace = ''
    textHeight = 0
    fontWeight = ''
    center = null
    backgroundColor = ''
    padding: number[] = []
    borderRadius = 0
    borderWidth = 0
    position = { set: vi.fn() }

    constructor(text: string) {
      this.text = text
    }
  },
}))

vi.mock('react-force-graph-3d', async () => {
  const ReactModule = await import('react')

  const ForceGraph3DMock = ReactModule.forwardRef<any, any>((props, ref) => {
    const linkForce = {
      distance: (fn: (link: GraphEdge) => number) => {
        props.graphData.links.forEach((link: GraphEdge) => {
          fgHarness.linkDistances.push(fn(link))
        })
        fgHarness.linkDistances.push(fn({ type: 'unknown' } as GraphEdge))
        return {
          strength: (strengthFn: (link: GraphEdge) => number) => {
            fgHarness.linkStrengths.push(strengthFn({ strength: 0.8 } as GraphEdge))
            return undefined
          },
        }
      },
    }

    ReactModule.useImperativeHandle(ref, () => ({
      zoomToFit: fgHarness.zoomToFit,
      camera: () => ({ position: fgHarness.cameraPos }),
      cameraPosition: fgHarness.cameraPosition,
      d3Force: (name: string) => {
        if (name === 'link') return linkForce
        if (name === 'charge') return { strength: fgHarness.chargeStrength }
        if (name === 'center') return { strength: fgHarness.centerStrength }
        return undefined
      },
    }))

    ReactModule.useEffect(() => {
      props.graphData.nodes.forEach((node: any) => {
        fgHarness.nodeColors.push(props.nodeColor(node))
        fgHarness.nodeLabels.push(props.nodeLabel(node))
        fgHarness.nodeObjects.push(props.nodeThreeObject(node))
      })
      props.graphData.links.forEach((link: GraphEdge) => {
        fgHarness.linkColors.push(props.linkColor(link))
        fgHarness.linkWidths.push(props.linkWidth(link))
      })
    }, [props])

    return (
      <div data-testid="force-graph">
        <button
          aria-label="Trigger node click"
          onClick={() => props.onNodeClick?.(props.graphData.nodes[0], { clientX: 11, clientY: 22 })}
        >
          click node
        </button>
        <button aria-label="Trigger background click" onClick={() => props.onBackgroundClick?.()}>
          click background
        </button>
      </div>
    )
  })

  return { default: ForceGraph3DMock }
})

function createGraphData(): GraphData {
  return {
    nodes: [
      {
        id: 'q1',
        type: 'question',
        label: 'How does curiosity shape learning over time?',
        data: {} as any,
        color: 'var(--graph-question)',
        size: 1,
        group: 'g1',
        x: 10,
        y: 0,
        z: 0,
      },
      {
        id: 'c1',
        type: 'concept',
        label: 'metacognition',
        data: {} as any,
        color: 'oklch(0.65 0.15 260)',
        size: 1,
        group: 'g1',
      },
      {
        id: 'c2',
        type: 'concept',
        label: 'attention',
        data: {} as any,
        color: 'var(--resolved-plain)',
        size: 1,
        group: 'g1',
      },
      {
        id: 's1',
        type: 'stash',
        label: 'A saved note',
        data: {} as any,
        color: '#1199aa',
        size: 1,
        group: 'g1',
      },
      {
        id: 'p1',
        type: 'probe',
        label: 'Probe 1',
        data: {} as any,
        color: 'var(--missing-token)',
        size: 1,
        group: 'g1',
      },
    ],
    edges: [
      { source: 'q1', target: 'c1', type: 'question-concept', strength: 0.8 },
      { source: 'q1', target: 's1', type: 'stash-source', strength: 0.6 },
      { source: 'q1', target: 'p1', type: 'probe-stash', strength: 0.7 },
      { source: 'c1', target: 'q1', type: 'concept-related', strength: 0.3 },
      { source: 'q1', target: 'q1', type: 'question-child', strength: 1 },
    ],
  }
}

describe('GraphView behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fgHarness.nodeColors = []
    fgHarness.nodeLabels = []
    fgHarness.nodeObjects = []
    fgHarness.linkColors = []
    fgHarness.linkWidths = []
    fgHarness.linkDistances = []
    fgHarness.linkStrengths = []
    fgHarness.cameraPos = { x: 10, y: 0, z: 0 }
    isMobile = false

    document.documentElement.style.setProperty('--graph-question', 'oklch(70% 0.14 250)')
    document.documentElement.style.setProperty('--resolved-plain', '#123456')
    graphContext = {
      graphData: createGraphData(),
      counts: { question: 1, concept: 1, stash: 1, probe: 1 },
      linkDistanceMult: 1.2,
      repulsionMult: 1.1,
      centeringMult: 0.9,
      frictionMult: 1,
      visualScale: 1.4,
    }
  })

  it('resolves colors, creates node objects, configures forces, and handles node click', () => {
    const onNodeClick = vi.fn()
    render(<GraphView onNodeClick={onNodeClick} leftOffset={42} />)

    expect(screen.getByTestId('force-graph')).toBeInTheDocument()
    expect(fgHarness.nodeColors.length).toBeGreaterThan(0)
    expect(fgHarness.nodeColors.some((color) => color.startsWith('rgb('))).toBe(true)
    expect(fgHarness.nodeColors.some((color) => color === '#1199aa')).toBe(true)
    expect(fgHarness.nodeColors.some((color) => color === '#dd8844')).toBe(true)
    expect(fgHarness.nodeObjects.length).toBeGreaterThanOrEqual(4)
    expect(fgHarness.nodeLabels[0]).toContain('question')
    expect(fgHarness.linkColors.length).toBeGreaterThanOrEqual(5)
    expect(fgHarness.linkWidths.length).toBeGreaterThanOrEqual(5)
    expect(fgHarness.linkDistances.length).toBeGreaterThanOrEqual(6)
    expect(fgHarness.chargeStrength).toHaveBeenCalled()
    expect(fgHarness.centerStrength).toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /Trigger node click/i }))
    expect(onNodeClick).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'q1' }),
      expect.objectContaining({ clientX: 11, clientY: 22 })
    )
    expect(fgHarness.cameraPosition).toHaveBeenCalled()

    const stats = screen.getByText(/1 Questions/i).closest('div')
    expect(stats).toHaveStyle('left: calc(42px + var(--space-4))')
  })

  it('supports imperative camera controls for reset, zoom in, and zoom out', () => {
    const ref = createRef<GraphViewHandle>()
    render(<GraphView ref={ref} />)

    fgHarness.cameraPosition.mockClear()
    fgHarness.zoomToFit.mockClear()

    fgHarness.cameraPos = { x: 0, y: 0, z: 0 }
    act(() => {
      ref.current?.zoomIn()
      ref.current?.zoomOut()
    })
    expect(fgHarness.cameraPosition).not.toHaveBeenCalled()

    fgHarness.cameraPos = { x: 10, y: 0, z: 0 }
    act(() => {
      ref.current?.zoomIn()
      ref.current?.zoomOut()
      ref.current?.resetCamera()
    })
    expect(fgHarness.cameraPosition).toHaveBeenCalledTimes(2)
    expect(fgHarness.zoomToFit).toHaveBeenCalledWith(600, 80)
  })

  it('shows and dismisses the mobile warning', () => {
    isMobile = true
    render(<GraphView />)

    expect(screen.getByText(/3D interaction is limited on mobile/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Dismiss warning/i }))
    expect(screen.queryByText(/3D interaction is limited on mobile/i)).not.toBeInTheDocument()
  })

  it('renders empty-state guidance when there are no graph nodes', () => {
    graphContext = {
      ...graphContext,
      graphData: { nodes: [], edges: [] },
      counts: { question: 0, concept: 0, stash: 0, probe: 0 },
    }

    render(<GraphView />)

    expect(screen.getByText(/No entities to visualize yet/i)).toBeInTheDocument()
    expect(screen.queryByTestId('force-graph')).not.toBeInTheDocument()
  })
})
