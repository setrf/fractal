import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StashItem } from './StashItem'
import type { ProbeColor } from '../../types/probe'
import type { StashItem as StashItemData } from '../../types/stash'

const probeContextState: {
  current: {
    isOpen: boolean
    activeProbeId: string | null
    toggleStashItemForProbe: ReturnType<typeof vi.fn>
    isStashItemSelectedForProbe: ReturnType<typeof vi.fn>
    getProbesForStashItem: ReturnType<typeof vi.fn>
  }
} = {
  current: {
    isOpen: false,
    activeProbeId: null,
    toggleStashItemForProbe: vi.fn(),
    isStashItemSelectedForProbe: vi.fn(() => false),
    getProbesForStashItem: vi.fn(() => []),
  },
}

vi.mock('../../context/ProbeContext', () => ({
  useProbeContext: () => probeContextState.current,
}))

const makeItem = (overrides: Partial<StashItemData> = {}): StashItemData => ({
  id: 's_1',
  type: 'highlight',
  content:
    'A very long line of content that should be truncated when rendered in collapsed mode for readability in the sidebar item card.',
  metadata: {
    sourceQuestion: 'Why do people enjoy recursive thought experiments in cognition?',
  },
  createdAt: Date.now(),
  tags: ['alpha', 'beta'],
  ...overrides,
})

const setAssignedProbes = (probes: Array<{ id: string; name: string; color: ProbeColor }>) => {
  probeContextState.current.getProbesForStashItem = vi.fn(() => probes)
}

describe('StashItem', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-09T12:00:00.000Z'))

    probeContextState.current = {
      isOpen: false,
      activeProbeId: null,
      toggleStashItemForProbe: vi.fn(),
      isStashItemSelectedForProbe: vi.fn(() => false),
      getProbesForStashItem: vi.fn(() => []),
    }
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('renders collapsed content and expands on click', () => {
    const onClick = vi.fn()
    const item = makeItem()

    render(<StashItem item={item} onDelete={vi.fn()} onClick={onClick} />)

    const node = screen.getByRole('button', { name: /highlight/i })
    expect(screen.getByText('Highlight')).toBeInTheDocument()
    expect(screen.getByText(/A very long line of content/).textContent).toContain('...')
    expect(screen.getByText(/from:/)).toBeInTheDocument()
    expect(screen.getByText('alpha')).toBeInTheDocument()
    expect(screen.getByText('beta')).toBeInTheDocument()

    fireEvent.click(node)

    expect(onClick).toHaveBeenCalledWith(item)
    expect(screen.getByText(item.content)).toBeInTheDocument()
  })

  it('supports keyboard activation with Enter and Space', () => {
    const onClick = vi.fn()
    const item = makeItem()

    render(<StashItem item={item} onDelete={vi.fn()} onClick={onClick} />)

    const node = screen.getByRole('button', { name: /highlight/i })
    fireEvent.keyDown(node, { key: 'Enter' })
    fireEvent.keyDown(node, { key: ' ' })

    expect(onClick).toHaveBeenCalledTimes(2)
  })

  it('ignores non-activation keys on keyboard interactions', () => {
    const onClick = vi.fn()
    const item = makeItem()

    render(<StashItem item={item} onDelete={vi.fn()} onClick={onClick} />)

    const node = screen.getByRole('button', { name: /highlight/i })
    fireEvent.keyDown(node, { key: 'Escape' })

    expect(onClick).not.toHaveBeenCalled()
  })

  it('deletes without triggering the item click callback', () => {
    const onClick = vi.fn()
    const onDelete = vi.fn()
    const item = makeItem()

    render(<StashItem item={item} onDelete={onDelete} onClick={onClick} />)

    fireEvent.click(screen.getByLabelText('Remove from stash'))

    expect(onDelete).toHaveBeenCalledWith(item.id)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('shows explanation summary/context and question/chat/note secondary info', () => {
    const { rerender } = render(
      <StashItem
        item={makeItem({
          type: 'explanation',
          content: 'Fallback explanation text',
          metadata: {
            summary: 'Summary line',
            context: 'Context for this explanation branch',
          },
        })}
        onDelete={vi.fn()}
      />
    )

    expect(screen.getByText('Summary line')).toBeInTheDocument()
    expect(screen.getByText('Context for this explanation branch')).toBeInTheDocument()

    rerender(
      <StashItem
        item={makeItem({
          type: 'question',
          content: 'Child question',
          metadata: { parentQuestion: 'Root branch question' },
        })}
        onDelete={vi.fn()}
      />
    )
    expect(screen.getByText(/parent:/i)).toBeInTheDocument()

    rerender(
      <StashItem
        item={makeItem({
          type: 'chat-message',
          content: 'Assistant reply',
          metadata: { role: 'assistant' },
        })}
        onDelete={vi.fn()}
      />
    )
    expect(screen.getByText('AI')).toBeInTheDocument()

    rerender(
      <StashItem
        item={makeItem({
          type: 'chat-message',
          content: 'User message',
          metadata: { role: 'user' },
        })}
        onDelete={vi.fn()}
      />
    )
    expect(screen.getByText('You')).toBeInTheDocument()

    rerender(
      <StashItem
        item={makeItem({
          type: 'note',
          content: 'Body of note',
          metadata: { title: 'Pinned title', linkedItemId: 's_linked' },
        })}
        onDelete={vi.fn()}
      />
    )
    expect(screen.getByText('Pinned title')).toBeInTheDocument()
    expect(screen.getByText('linked note')).toBeInTheDocument()
  })

  it('shows probe selection checkbox and toggles assignment for active probe', () => {
    const item = makeItem()
    probeContextState.current.isOpen = true
    probeContextState.current.activeProbeId = 'p_1'

    render(<StashItem item={item} onDelete={vi.fn()} checkboxOnboardingId="stash-checkbox" />)

    const addButton = screen.getByLabelText('Add to probe')
    expect(addButton).toHaveAttribute('data-onboarding', 'stash-checkbox')

    fireEvent.click(addButton)
    expect(probeContextState.current.toggleStashItemForProbe).toHaveBeenCalledWith('p_1', item.id)
  })

  it('shows checked state when already selected in active probe', () => {
    const item = makeItem()
    probeContextState.current.isOpen = true
    probeContextState.current.activeProbeId = 'p_2'
    probeContextState.current.isStashItemSelectedForProbe = vi.fn(() => true)

    render(<StashItem item={item} onDelete={vi.fn()} />)

    expect(screen.getByLabelText('Remove from probe')).toBeInTheDocument()
    expect(screen.getByText('✓')).toBeInTheDocument()
  })

  it('renders probe badges for items assigned to probes', () => {
    setAssignedProbes([
      { id: 'p_a', name: 'Probe Alpha', color: 'blue' },
      { id: 'p_b', name: 'Probe Beta', color: 'red' },
    ])

    render(<StashItem item={makeItem()} onDelete={vi.fn()} />)

    expect(screen.getByTitle('Probe Alpha')).toBeInTheDocument()
    expect(screen.getByTitle('Probe Beta')).toBeInTheDocument()
  })

  it('hides probe checkbox when probe sidebar or active probe is unavailable', () => {
    const { rerender } = render(<StashItem item={makeItem()} onDelete={vi.fn()} />)
    expect(screen.queryByLabelText(/probe/i)).not.toBeInTheDocument()

    probeContextState.current.isOpen = true
    probeContextState.current.activeProbeId = null
    rerender(<StashItem item={makeItem()} onDelete={vi.fn()} />)
    expect(screen.queryByLabelText(/probe/i)).not.toBeInTheDocument()
  })

  it('supports optional dragging and delegates drag start', () => {
    const onDragStart = vi.fn()
    const item = makeItem()

    render(
      <StashItem
        item={item}
        onDelete={vi.fn()}
        draggable={true}
        onDragStart={onDragStart}
      />
    )

    const node = screen.getByRole('button', { name: /highlight/i })
    fireEvent.dragStart(node)

    expect(onDragStart).toHaveBeenCalled()
    expect(onDragStart).toHaveBeenCalledWith(expect.any(Object), item)
    expect(screen.getByText('⋮⋮')).toBeInTheDocument()
  })

  it('supports draggable rendering without a drag-start callback', () => {
    const item = makeItem()

    render(<StashItem item={item} onDelete={vi.fn()} draggable={true} />)

    const node = screen.getByRole('button', { name: /highlight/i })
    fireEvent.dragStart(node)

    expect(screen.getByText('⋮⋮')).toBeInTheDocument()
  })

  it('covers fallback display/secondary-info branches and unknown item-type defaults', () => {
    const { rerender } = render(
      <StashItem
        item={makeItem({
          type: 'explanation',
          content: 'Explanation fallback content',
          metadata: {
            context: '',
          },
        })}
        onDelete={vi.fn()}
      />
    )
    expect(screen.getByText('Explanation fallback content')).toBeInTheDocument()
    expect(screen.queryByText(/^from:/i)).not.toBeInTheDocument()

    rerender(
      <StashItem
        item={makeItem({
          type: 'note',
          content: 'Untitled note content',
          metadata: {},
        })}
        onDelete={vi.fn()}
      />
    )
    expect(screen.getByText('Untitled note content')).toBeInTheDocument()
    expect(screen.queryByText('linked note')).not.toBeInTheDocument()

    rerender(
      <StashItem
        item={makeItem({
          type: 'highlight',
          metadata: {},
        })}
        onDelete={vi.fn()}
      />
    )
    expect(screen.queryByText(/^from:/i)).not.toBeInTheDocument()

    rerender(
      <StashItem
        item={makeItem({
          type: 'question',
          metadata: {},
        })}
        onDelete={vi.fn()}
      />
    )
    expect(screen.queryByText(/^parent:/i)).not.toBeInTheDocument()

    rerender(
      <StashItem
        item={makeItem({
          type: 'chat-message',
          metadata: {},
        })}
        onDelete={vi.fn()}
      />
    )
    expect(screen.queryByText('AI')).not.toBeInTheDocument()
    expect(screen.queryByText('You')).not.toBeInTheDocument()

    rerender(
      <StashItem
        item={makeItem({
          // Exercise type-class and secondary-info switch defaults.
          type: 'unknown-type' as any,
          metadata: {},
        })}
        onDelete={vi.fn()}
      />
    )
    expect(screen.getByText(/A very long line of content/)).toBeInTheDocument()
  })

  it('formats timestamps for just-now/minute/hour/day and older-date branches', () => {
    const now = Date.now()
    const { rerender } = render(
      <StashItem item={makeItem({ createdAt: now - 5_000 })} onDelete={vi.fn()} />
    )
    expect(screen.getByText('just now')).toBeInTheDocument()

    rerender(<StashItem item={makeItem({ createdAt: now - 5 * 60_000 })} onDelete={vi.fn()} />)
    expect(screen.getByText('5m ago')).toBeInTheDocument()

    rerender(<StashItem item={makeItem({ createdAt: now - 2 * 3_600_000 })} onDelete={vi.fn()} />)
    expect(screen.getByText('2h ago')).toBeInTheDocument()

    rerender(<StashItem item={makeItem({ createdAt: now - 3 * 86_400_000 })} onDelete={vi.fn()} />)
    expect(screen.getByText('3d ago')).toBeInTheDocument()

    rerender(<StashItem item={makeItem({ createdAt: now - 10 * 86_400_000 })} onDelete={vi.fn()} />)
    const timestamp = document.querySelector('[class*="timestamp"]') as HTMLElement
    expect(timestamp).toBeInTheDocument()
    expect(timestamp.textContent).not.toContain('ago')
    expect(timestamp.textContent).not.toBe('just now')
  })
})
