import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ViewModeToggle } from './ViewModeToggle'

const contextHarness = vi.hoisted(() => ({
  viewMode: 'traditional' as 'traditional' | 'graph',
  isGraphView: false,
  toggleViewMode: vi.fn(),
}))

vi.mock('../../context/ViewModeContext', () => ({
  useViewModeContext: () => contextHarness,
}))

describe('ViewModeToggle', () => {
  it('renders graph-switch affordance in traditional mode and uses default right offset', () => {
    contextHarness.viewMode = 'traditional'
    contextHarness.isGraphView = false

    render(<ViewModeToggle />)

    const button = screen.getByRole('button', { name: /switch to graph view/i })
    expect(button).toHaveAttribute('title', 'Switch to 3D graph view')
    expect(button).toHaveAttribute('data-view-mode', 'traditional')
    expect(button).toHaveStyle({ right: 'calc(64px + var(--space-4))' })
    expect(screen.getByText('◈')).toBeInTheDocument()
  })

  it('renders traditional-switch affordance in graph mode and respects custom right offset', () => {
    contextHarness.viewMode = 'graph'
    contextHarness.isGraphView = true

    render(<ViewModeToggle rightOffset={100} />)

    const button = screen.getByRole('button', { name: /switch to traditional view/i })
    expect(button).toHaveAttribute('title', 'Switch to traditional tree view')
    expect(button).toHaveAttribute('data-view-mode', 'graph')
    expect(button).toHaveStyle({ right: 'calc(148px + var(--space-4))' })
    expect(screen.getByText('⌘')).toBeInTheDocument()
  })

  it('calls toggle handler on click', () => {
    contextHarness.viewMode = 'traditional'
    contextHarness.isGraphView = false
    contextHarness.toggleViewMode.mockClear()

    render(<ViewModeToggle />)
    fireEvent.click(screen.getByRole('button', { name: /switch to graph view/i }))

    expect(contextHarness.toggleViewMode).toHaveBeenCalledTimes(1)
  })
})
