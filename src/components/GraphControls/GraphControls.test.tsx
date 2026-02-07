import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GraphControls } from './GraphControls'
import type { GraphContextValue } from '../../context/GraphContext'

const mockUseGraphContext = vi.fn()
const mockUseIsMobile = vi.fn()

vi.mock('../../context/GraphContext', () => ({
  useGraphContext: () => mockUseGraphContext(),
}))

vi.mock('../../hooks/useIsMobile', () => ({
  useIsMobile: () => mockUseIsMobile(),
}))

interface ControlsSpies {
  toggleNodeType: ReturnType<typeof vi.fn>
  setLinkDistanceMult: ReturnType<typeof vi.fn>
  setRepulsionMult: ReturnType<typeof vi.fn>
  setCenteringMult: ReturnType<typeof vi.fn>
  setFrictionMult: ReturnType<typeof vi.fn>
  setVisualScale: ReturnType<typeof vi.fn>
}

function createContextValue(spies: ControlsSpies): GraphContextValue {
  return {
    nodes: [],
    edges: [],
    graphData: { nodes: [], edges: [] },
    isLoading: false,
    counts: { question: 4, concept: 3, stash: 2, probe: 1 },
    filters: {
      showQuestions: true,
      showConcepts: true,
      showStashItems: true,
      showProbes: true,
    },
    setFilters: vi.fn(),
    toggleNodeType: spies.toggleNodeType,
    resetFilters: vi.fn(),
    linkDistanceMult: 1.0,
    setLinkDistanceMult: spies.setLinkDistanceMult,
    repulsionMult: 1.1,
    setRepulsionMult: spies.setRepulsionMult,
    centeringMult: 0.9,
    setCenteringMult: spies.setCenteringMult,
    frictionMult: 1.2,
    setFrictionMult: spies.setFrictionMult,
    visualScale: 1.3,
    setVisualScale: spies.setVisualScale,
  }
}

function getSlider(label: string): HTMLInputElement {
  const row = screen.getByText(label).closest('div')
  if (!row) {
    throw new Error(`Unable to find slider row for ${label}`)
  }
  const input = row.querySelector('input[type="range"]')
  if (!(input instanceof HTMLInputElement)) {
    throw new Error(`Unable to find slider for ${label}`)
  }
  return input
}

describe('GraphControls', () => {
  let spies: ControlsSpies

  beforeEach(() => {
    spies = {
      toggleNodeType: vi.fn(),
      setLinkDistanceMult: vi.fn(),
      setRepulsionMult: vi.fn(),
      setCenteringMult: vi.fn(),
      setFrictionMult: vi.fn(),
      setVisualScale: vi.fn(),
    }
    mockUseIsMobile.mockReturnValue(false)
    mockUseGraphContext.mockReturnValue(createContextValue(spies))
  })

  it('renders desktop controls and camera action callbacks', () => {
    const onResetCamera = vi.fn()
    const onZoomIn = vi.fn()
    const onZoomOut = vi.fn()

    render(
      <GraphControls
        onResetCamera={onResetCamera}
        onZoomIn={onZoomIn}
        onZoomOut={onZoomOut}
      />
    )

    expect(screen.getByText('Legend & Filters')).toBeInTheDocument()
    expect(screen.getByText('Rotate')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Reset camera' }))
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }))

    expect(onResetCamera).toHaveBeenCalledTimes(1)
    expect(onZoomIn).toHaveBeenCalledTimes(1)
    expect(onZoomOut).toHaveBeenCalledTimes(1)
  })

  it('toggles node-type visibility filters', () => {
    render(<GraphControls />)

    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[0])
    fireEvent.click(checkboxes[1])
    fireEvent.click(checkboxes[2])
    fireEvent.click(checkboxes[3])

    expect(spies.toggleNodeType).toHaveBeenNthCalledWith(1, 'question')
    expect(spies.toggleNodeType).toHaveBeenNthCalledWith(2, 'concept')
    expect(spies.toggleNodeType).toHaveBeenNthCalledWith(3, 'stash')
    expect(spies.toggleNodeType).toHaveBeenNthCalledWith(4, 'probe')
  })

  it('opens settings panel, updates dynamics sliders, and resets all values', () => {
    render(<GraphControls />)

    fireEvent.click(screen.getByRole('button', { name: 'Graph settings' }))
    expect(screen.getByText('Dynamics')).toBeInTheDocument()

    fireEvent.change(getSlider('Distance'), { target: { value: '1.7' } })
    fireEvent.change(getSlider('Repulsion'), { target: { value: '2.2' } })
    fireEvent.change(getSlider('Gravity'), { target: { value: '1.4' } })
    fireEvent.change(getSlider('Friction'), { target: { value: '2.5' } })
    fireEvent.change(getSlider('Visual Scale'), { target: { value: '2.1' } })

    expect(spies.setLinkDistanceMult).toHaveBeenCalledWith(1.7)
    expect(spies.setRepulsionMult).toHaveBeenCalledWith(2.2)
    expect(spies.setCenteringMult).toHaveBeenCalledWith(1.4)
    expect(spies.setFrictionMult).toHaveBeenCalledWith(2.5)
    expect(spies.setVisualScale).toHaveBeenCalledWith(2.1)

    fireEvent.click(screen.getByRole('button', { name: 'Reset All' }))

    expect(spies.setLinkDistanceMult).toHaveBeenCalledWith(1)
    expect(spies.setRepulsionMult).toHaveBeenCalledWith(1)
    expect(spies.setCenteringMult).toHaveBeenCalledWith(1)
    expect(spies.setFrictionMult).toHaveBeenCalledWith(1)
    expect(spies.setVisualScale).toHaveBeenCalledWith(1)
  })

  it('shows mobile collapse toggle and hides shortcut hints', () => {
    mockUseIsMobile.mockReturnValue(true)
    render(<GraphControls />)

    expect(screen.getByRole('button', { name: 'Expand controls' })).toBeInTheDocument()
    expect(screen.queryByText('Rotate')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Expand controls' }))
    expect(screen.getByRole('button', { name: 'Collapse controls' })).toBeInTheDocument()
  })
})
