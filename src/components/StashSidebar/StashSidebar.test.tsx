import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, createEvent } from '@testing-library/react'
import type { StashItem } from '../../types/stash'
import { StashSidebar } from './StashSidebar'

const stashContextState: {
  current: {
    items: StashItem[]
    displayedItems: StashItem[]
    removeItem: ReturnType<typeof vi.fn>
    clearAll: ReturnType<typeof vi.fn>
    exportToJSON: ReturnType<typeof vi.fn>
    isOpen: boolean
    setIsOpen: ReturnType<typeof vi.fn>
    toggleOpen: ReturnType<typeof vi.fn>
    filterType: StashItem['type'] | null
    setFilterType: ReturnType<typeof vi.fn>
    searchQuery: string
    setSearchQuery: ReturnType<typeof vi.fn>
    count: number
    addItem: ReturnType<typeof vi.fn>
    reorderItem: ReturnType<typeof vi.fn>
    externalDragHover: boolean
    sidebarWidth: number
    setSidebarWidth: ReturnType<typeof vi.fn>
  }
} = {
  current: {} as never,
}

const probeContextState: {
  current: {
    setExternalDragHover: ReturnType<typeof vi.fn>
  }
} = {
  current: {
    setExternalDragHover: vi.fn(),
  },
}

const mobileState = { value: false }

vi.mock('../../context/StashContext', () => ({
  useStashContext: () => stashContextState.current,
}))

vi.mock('../../context/ProbeContext', () => ({
  useProbeContext: () => probeContextState.current,
}))

vi.mock('../../hooks/useIsMobile', () => ({
  useIsMobile: () => mobileState.value,
}))

vi.mock('../StashItem', () => ({
  StashItem: ({
    item,
    onDelete,
    onClick,
  }: {
    item: StashItem
    onDelete: (id: string) => void
    onClick?: (item: StashItem) => void
  }) => (
    <div data-testid={`mock-stash-item-${item.id}`}>
      <span>{item.content}</span>
      <button onClick={() => onClick?.(item)} aria-label={`open-${item.id}`}>
        open
      </button>
      <button onClick={() => onDelete(item.id)} aria-label={`delete-${item.id}`}>
        delete
      </button>
    </div>
  ),
}))

const createItem = (id: string, overrides: Partial<StashItem> = {}): StashItem => ({
  id,
  type: 'note',
  content: `item-${id}`,
  metadata: {},
  createdAt: Date.now(),
  ...overrides,
})

const setContext = (overrides: Partial<typeof stashContextState.current> = {}) => {
  const items = overrides.items ?? [createItem('s1'), createItem('s2')]
  const displayedItems = overrides.displayedItems ?? items
  stashContextState.current = {
    items,
    displayedItems,
    removeItem: vi.fn(),
    clearAll: vi.fn(),
    exportToJSON: vi.fn(() => JSON.stringify(items)),
    isOpen: true,
    setIsOpen: vi.fn(),
    toggleOpen: vi.fn(),
    filterType: null,
    setFilterType: vi.fn(),
    searchQuery: '',
    setSearchQuery: vi.fn(),
    count: items.length,
    addItem: vi.fn(),
    reorderItem: vi.fn(),
    externalDragHover: false,
    sidebarWidth: 320,
    setSidebarWidth: vi.fn(),
    ...overrides,
  }
}

describe('StashSidebar', () => {
  beforeEach(() => {
    mobileState.value = false
    probeContextState.current = { setExternalDragHover: vi.fn() }
    setContext()

    if (!('createObjectURL' in URL)) {
      Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn() })
    }
    if (!('revokeObjectURL' in URL)) {
      Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.querySelector('[data-probe-sidebar="true"]')?.remove()
  })

  it('renders collapsed desktop state and toggles open', () => {
    setContext({ isOpen: false, count: 3 })
    render(<StashSidebar />)

    const toggle = screen.getByLabelText('Expand stash')
    expect(toggle).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()

    fireEvent.click(toggle)
    expect(stashContextState.current.toggleOpen).toHaveBeenCalledTimes(1)
  })

  it('renders open state with search/filter controls and item click wiring', () => {
    const onItemClick = vi.fn()
    setContext({
      displayedItems: [
        createItem('s1', { type: 'highlight', content: 'highlighted concept' }),
      ],
      filterType: null,
      searchQuery: '',
    })
    render(<StashSidebar onItemClick={onItemClick} />)

    fireEvent.change(screen.getByLabelText('Search stash'), { target: { value: 'probe' } })
    expect(stashContextState.current.setSearchQuery).toHaveBeenCalledWith('probe')

    fireEvent.click(screen.getByTitle('Highlight'))
    expect(stashContextState.current.setFilterType).toHaveBeenCalledWith('highlight')

    fireEvent.click(screen.getByLabelText('open-s1'))
    expect(onItemClick).toHaveBeenCalledWith(expect.objectContaining({ id: 's1' }))
  })

  it('shows empty state messaging for empty and no-match scenarios', () => {
    const { rerender } = render(
      (() => {
        setContext({ displayedItems: [], items: [], count: 0, searchQuery: '', filterType: null })
        return <StashSidebar />
      })()
    )
    expect(screen.getByText('Your stash is empty')).toBeInTheDocument()

    setContext({ displayedItems: [], items: [createItem('s1')], count: 1, searchQuery: 'x' })
    rerender(<StashSidebar />)
    expect(screen.getByText('No matching items')).toBeInTheDocument()
  })

  it('creates notes, validates blank content, and supports cancel/reset', () => {
    render(<StashSidebar />)

    fireEvent.click(screen.getByLabelText('Add a note'))
    const title = screen.getByPlaceholderText('Note title (optional)')
    const body = screen.getByPlaceholderText('Write your note...')

    fireEvent.change(title, { target: { value: '  My note  ' } })
    fireEvent.change(body, { target: { value: '   ' } })
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()

    fireEvent.change(body, { target: { value: '  content body  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(stashContextState.current.addItem).toHaveBeenCalledWith({
      type: 'note',
      content: 'content body',
      metadata: { title: 'My note' },
    })
    expect(screen.queryByPlaceholderText('Write your note...')).not.toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Add a note'))
    fireEvent.change(screen.getByPlaceholderText('Note title (optional)'), { target: { value: 'temp' } })
    fireEvent.change(screen.getByPlaceholderText('Write your note...'), { target: { value: 'temp body' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByPlaceholderText('Write your note...')).not.toBeInTheDocument()
  })

  it('keeps note-save disabled for blank content and supports untitled note metadata fallback', () => {
    render(<StashSidebar />)

    fireEvent.click(screen.getByLabelText('Add a note'))
    const body = screen.getByPlaceholderText('Write your note...')
    const save = screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement

    fireEvent.change(body, { target: { value: '   ' } })
    expect(save).toBeDisabled()

    fireEvent.change(body, { target: { value: 'saved without title' } })
    fireEvent.click(save)

    expect(stashContextState.current.addItem).toHaveBeenCalledWith({
      type: 'note',
      content: 'saved without title',
      metadata: { title: undefined },
    })
  })

  it('exports and clears stash items from footer actions', () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const createUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test')
    const revokeUrlSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

    render(<StashSidebar />)

    fireEvent.click(screen.getByTitle('Export as JSON'))
    expect(stashContextState.current.exportToJSON).toHaveBeenCalled()
    expect(createUrlSpy).toHaveBeenCalled()
    expect(clickSpy).toHaveBeenCalled()
    expect(revokeUrlSpy).toHaveBeenCalled()

    fireEvent.click(screen.getByTitle('Clear all items'))
    expect(stashContextState.current.clearAll).toHaveBeenCalled()
  })

  it('handles external drag/drop payloads and malformed drop data', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { container } = render(<StashSidebar />)
    const aside = container.querySelector('aside') as HTMLElement

    const externalDataTransfer = {
      types: ['application/json'],
      dropEffect: 'none',
      getData: vi.fn(() =>
        JSON.stringify({
          type: 'note',
          content: 'from popup',
          metadata: {},
        })
      ),
    }

    fireEvent.dragOver(aside, { dataTransfer: externalDataTransfer })
    expect(screen.getByText('Drop to stash')).toBeInTheDocument()

    fireEvent.drop(aside, { dataTransfer: externalDataTransfer })
    expect(stashContextState.current.addItem).toHaveBeenCalledWith({
      type: 'note',
      content: 'from popup',
      metadata: {},
    })

    fireEvent.dragOver(aside, { dataTransfer: { ...externalDataTransfer, getData: () => '{bad json' } })
    fireEvent.drop(aside, { dataTransfer: { ...externalDataTransfer, getData: () => '{bad json' } })
    expect(consoleError).toHaveBeenCalled()
  })

  it('ignores non-external drag events and empty dropped payloads', () => {
    const { container } = render(<StashSidebar />)
    const aside = container.querySelector('aside') as HTMLElement
    const internalTransfer = {
      types: ['text/x-stash-reorder'],
      dropEffect: 'none',
      getData: vi.fn(() => ''),
    }

    fireEvent.dragOver(aside, { dataTransfer: internalTransfer })
    expect(screen.queryByText('Drop to stash')).not.toBeInTheDocument()

    fireEvent.dragLeave(aside, { dataTransfer: internalTransfer })
    expect(screen.queryByText('Drop to stash')).not.toBeInTheDocument()

    fireEvent.drop(aside, { dataTransfer: internalTransfer })
    expect(stashContextState.current.addItem).not.toHaveBeenCalled()
  })

  it('handles external drag leave transitions and item-level external drag over', () => {
    const { container } = render(<StashSidebar />)
    const aside = container.querySelector('aside') as HTMLElement
    const externalTransfer = {
      types: ['application/json'],
      dropEffect: 'none',
      getData: vi.fn(() =>
        JSON.stringify({
          type: 'note',
          content: 'external item drop',
          metadata: {},
        })
      ),
    }

    fireEvent.dragOver(aside, { dataTransfer: externalTransfer })
    expect(screen.getByText('Drop to stash')).toBeInTheDocument()

    const inside = document.createElement('div')
    aside.appendChild(inside)
    const leaveInsideEvent = createEvent.dragLeave(aside)
    Object.defineProperty(leaveInsideEvent, 'dataTransfer', { value: externalTransfer })
    Object.defineProperty(leaveInsideEvent, 'relatedTarget', { value: inside })
    fireEvent(aside, leaveInsideEvent)
    expect(screen.getByText('Drop to stash')).toBeInTheDocument()

    const outside = document.createElement('div')
    document.body.appendChild(outside)
    const leaveOutsideEvent = createEvent.dragLeave(aside)
    Object.defineProperty(leaveOutsideEvent, 'dataTransfer', { value: externalTransfer })
    Object.defineProperty(leaveOutsideEvent, 'relatedTarget', { value: outside })
    fireEvent(aside, leaveOutsideEvent)
    expect(screen.queryByText('Drop to stash')).not.toBeInTheDocument()

    fireEvent.dragOver(aside, { dataTransfer: externalTransfer })
    expect(screen.getByText('Drop to stash')).toBeInTheDocument()
    const leaveWindowEvent = createEvent.dragLeave(aside)
    Object.defineProperty(leaveWindowEvent, 'dataTransfer', { value: externalTransfer })
    Object.defineProperty(leaveWindowEvent, 'relatedTarget', { value: null })
    fireEvent(aside, leaveWindowEvent)
    expect(screen.queryByText('Drop to stash')).not.toBeInTheDocument()

    const wrapper = screen.getByTestId('mock-stash-item-s1').closest('[draggable="true"]') as HTMLElement
    const dragOverEvent = createEvent.dragOver(wrapper)
    Object.defineProperty(dragOverEvent, 'dataTransfer', { value: externalTransfer })
    fireEvent(wrapper, dragOverEvent)

    fireEvent.drop(wrapper, { dataTransfer: externalTransfer })
    fireEvent.dragLeave(wrapper, { dataTransfer: externalTransfer })
    expect(stashContextState.current.addItem).toHaveBeenCalledWith({
      type: 'note',
      content: 'external item drop',
      metadata: {},
    })
  })

  it('handles internal drag reorder and remove-on-drop-outside flow', () => {
    setContext({
      items: [createItem('s1'), createItem('s2')],
      displayedItems: [createItem('s1'), createItem('s2')],
    })
    const { container } = render(<StashSidebar />)
    const aside = container.querySelector('aside') as HTMLElement
    aside.getBoundingClientRect = vi.fn(() => ({
      left: 100,
      top: 100,
      right: 300,
      bottom: 400,
      width: 300,
      height: 400,
      x: 100,
      y: 100,
      toJSON: () => ({}),
    } as DOMRect))

    const firstWrapper = screen.getByTestId('mock-stash-item-s1').closest('[draggable="true"]') as HTMLElement
    const secondWrapper = screen.getByTestId('mock-stash-item-s2').closest('[draggable="true"]') as HTMLElement
    const internalTransfer = {
      types: ['text/x-stash-reorder'],
      setData: vi.fn(),
      effectAllowed: 'all',
      getData: vi.fn(() => ''),
    }

    fireEvent.dragStart(firstWrapper, { dataTransfer: internalTransfer })
    expect(internalTransfer.setData).toHaveBeenCalledWith('text/x-stash-reorder', '0')
    expect(internalTransfer.setData).toHaveBeenCalledWith('text/x-stash-item', 's1')
    expect(probeContextState.current.setExternalDragHover).toHaveBeenCalledWith(true)

    fireEvent.dragOver(secondWrapper, { dataTransfer: internalTransfer })
    fireEvent.drop(secondWrapper, { dataTransfer: internalTransfer })
    expect(stashContextState.current.reorderItem).toHaveBeenCalledWith(0, 1)

    const dragEnd = createEvent.dragEnd(firstWrapper)
    Object.defineProperty(dragEnd, 'clientX', { value: 0 })
    Object.defineProperty(dragEnd, 'clientY', { value: 0 })
    fireEvent(firstWrapper, dragEnd)
    expect(stashContextState.current.removeItem).toHaveBeenCalledWith('s1')
    expect(probeContextState.current.setExternalDragHover).toHaveBeenCalledWith(false)
  })

  it('covers drag/drop guard paths when reorder targets are invalid', () => {
    const allItems = [createItem('s1')]
    const displayedItems = [createItem('s1'), createItem('s2')]
    setContext({ items: allItems, displayedItems })

    render(<StashSidebar />)
    const firstWrapper = screen.getByTestId('mock-stash-item-s1').closest('[draggable="true"]') as HTMLElement
    const secondWrapper = screen.getByTestId('mock-stash-item-s2').closest('[draggable="true"]') as HTMLElement

    const internalTransfer = {
      types: ['text/x-stash-reorder'],
      setData: vi.fn(),
      getData: vi.fn(() => ''),
    }

    fireEvent.dragStart(firstWrapper, { dataTransfer: internalTransfer })
    fireEvent.dragOver(firstWrapper, { dataTransfer: internalTransfer })
    fireEvent.drop(secondWrapper, { dataTransfer: internalTransfer })

    expect(stashContextState.current.reorderItem).not.toHaveBeenCalled()
  })

  it('does not remove dragged item when ending drag over probe sidebar', () => {
    setContext({
      items: [createItem('s1')],
      displayedItems: [createItem('s1')],
    })
    render(<StashSidebar />)

    const probeSidebar = document.createElement('div')
    probeSidebar.setAttribute('data-probe-sidebar', 'true')
    probeSidebar.getBoundingClientRect = vi.fn(() => ({
      left: 800,
      top: 0,
      right: 1100,
      bottom: 400,
      width: 300,
      height: 400,
      x: 800,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect))
    document.body.appendChild(probeSidebar)

    const firstWrapper = screen.getByTestId('mock-stash-item-s1').closest('[draggable="true"]') as HTMLElement
    const internalTransfer = {
      types: ['text/x-stash-reorder'],
      setData: vi.fn(),
      getData: vi.fn(() => ''),
    }
    fireEvent.dragStart(firstWrapper, { dataTransfer: internalTransfer })
    fireEvent.dragEnd(firstWrapper, { clientX: 900, clientY: 100 })

    expect(stashContextState.current.removeItem).not.toHaveBeenCalled()
  })

  it('covers probe-hit testing short-circuit branches and drag-end no-op without active drag item', () => {
    setContext({
      items: [createItem('s1')],
      displayedItems: [createItem('s1')],
    })
    const { container } = render(<StashSidebar />)
    const aside = container.querySelector('aside') as HTMLElement
    aside.getBoundingClientRect = vi.fn(() => ({
      left: 100,
      top: 100,
      right: 300,
      bottom: 400,
      width: 200,
      height: 300,
      x: 100,
      y: 100,
      toJSON: () => ({}),
    } as DOMRect))

    const probeSidebar = document.createElement('div')
    probeSidebar.setAttribute('data-probe-sidebar', 'true')
    probeSidebar.getBoundingClientRect = vi.fn(() => ({
      left: 800,
      top: 100,
      right: 1000,
      bottom: 300,
      width: 200,
      height: 200,
      x: 800,
      y: 100,
      toJSON: () => ({}),
    } as DOMRect))
    document.body.appendChild(probeSidebar)

    const firstWrapper = screen.getByTestId('mock-stash-item-s1').closest('[draggable="true"]') as HTMLElement
    const internalTransfer = {
      types: ['text/x-stash-reorder'],
      setData: vi.fn(),
      getData: vi.fn(() => ''),
    }

    fireEvent.dragStart(firstWrapper, { dataTransfer: internalTransfer })
    const endXRight = createEvent.dragEnd(firstWrapper)
    Object.defineProperty(endXRight, 'clientX', { value: 1200 })
    Object.defineProperty(endXRight, 'clientY', { value: 200 })
    fireEvent(firstWrapper, endXRight) // x > probe.right

    fireEvent.dragStart(firstWrapper, { dataTransfer: internalTransfer })
    const endYTop = createEvent.dragEnd(firstWrapper)
    Object.defineProperty(endYTop, 'clientX', { value: 900 })
    Object.defineProperty(endYTop, 'clientY', { value: 50 })
    fireEvent(firstWrapper, endYTop) // y < probe.top

    fireEvent.dragStart(firstWrapper, { dataTransfer: internalTransfer })
    const endYBottom = createEvent.dragEnd(firstWrapper)
    Object.defineProperty(endYBottom, 'clientX', { value: 900 })
    Object.defineProperty(endYBottom, 'clientY', { value: 350 })
    fireEvent(firstWrapper, endYBottom) // y > probe.bottom

    const endNoDrag = createEvent.dragEnd(firstWrapper)
    Object.defineProperty(endNoDrag, 'clientX', { value: 0 })
    Object.defineProperty(endNoDrag, 'clientY', { value: 0 })
    fireEvent(firstWrapper, endNoDrag) // no active dragged item

    expect(stashContextState.current.removeItem).toHaveBeenCalledTimes(3)
  })

  it('shows overlay when external hover state is already true', () => {
    setContext({ externalDragHover: true })
    render(<StashSidebar />)
    expect(screen.getByText('Drop to stash')).toBeInTheDocument()
  })

  it('supports mobile-specific close action', () => {
    mobileState.value = true
    setContext({ isOpen: true })

    render(<StashSidebar />)
    fireEvent.click(screen.getByLabelText('Close sidebar'))

    expect(stashContextState.current.setIsOpen).toHaveBeenCalledWith(false)
  })

  it('resizes sidebar width with min/max clamping', () => {
    render(<StashSidebar />)

    const handle = screen.getByRole('separator', { name: 'Resize sidebar' })
    fireEvent.mouseDown(handle, { clientX: 200 })

    fireEvent.mouseMove(document, { clientX: 2000 })
    fireEvent.mouseMove(document, { clientX: -2000 })
    fireEvent.mouseUp(document)

    expect(stashContextState.current.setSidebarWidth).toHaveBeenCalledWith(600)
    expect(stashContextState.current.setSidebarWidth).toHaveBeenCalledWith(200)
  })
})
