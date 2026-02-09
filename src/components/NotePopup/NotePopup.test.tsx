import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { NotePopup } from './NotePopup'

const stashContextState: {
  current: {
    addItem: ReturnType<typeof vi.fn>
    hasItem: ReturnType<typeof vi.fn>
    setExternalDragHover: ReturnType<typeof vi.fn>
  }
} = {
  current: {
    addItem: vi.fn(),
    hasItem: vi.fn(() => false),
    setExternalDragHover: vi.fn(),
  },
}

vi.mock('../../context/StashContext', () => ({
  useStashContext: () => stashContextState.current,
}))

const defaultProps = {
  id: 'note_1',
  position: { x: 100, y: 120 },
  onClose: vi.fn(),
}

describe('NotePopup', () => {
  beforeEach(() => {
    stashContextState.current = {
      addItem: vi.fn(),
      hasItem: vi.fn(() => false),
      setExternalDragHover: vi.fn(),
    }

    vi.restoreAllMocks()
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1280 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: 800 })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.querySelector('[data-stash-sidebar="true"]')?.remove()
  })

  it('renders editable mode, focuses title, and emits onUpdate on edits', () => {
    const onUpdate = vi.fn()
    render(<NotePopup {...defaultProps} onUpdate={onUpdate} initialContent="first body" />)

    const titleInput = screen.getByPlaceholderText('Note title...')
    const contentInput = screen.getByPlaceholderText('Write your note here...')

    expect(titleInput).toHaveFocus()
    expect(onUpdate).toHaveBeenCalledWith('note_1', '', 'first body')

    fireEvent.change(titleInput, { target: { value: 'Draft title' } })
    fireEvent.change(contentInput, { target: { value: 'Updated body' } })

    expect(onUpdate).toHaveBeenLastCalledWith('note_1', 'Draft title', 'Updated body')
  })

  it('renders read-only mode for non-note sources', () => {
    render(
      <NotePopup
        {...defaultProps}
        readOnly={true}
        sourceType="explanation"
        initialTitle="Read only title"
        initialContent="Read only content"
      />
    )

    expect(screen.getByText('Explanation')).toBeInTheDocument()
    expect(screen.getByText('Read only title')).toBeInTheDocument()
    expect(screen.getByText('Read only content')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Note title...')).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Write your note here...')).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Add to Stash/i)).not.toBeInTheDocument()
  })

  it('stashes note content and closes when stash button is pressed', () => {
    const onClose = vi.fn()
    render(
      <NotePopup
        {...defaultProps}
        onClose={onClose}
        initialTitle="  title  "
        initialContent="  body content  "
      />
    )

    fireEvent.click(screen.getByLabelText('Add to Stash'))

    expect(stashContextState.current.addItem).toHaveBeenCalledWith({
      type: 'note',
      content: 'body content',
      metadata: { title: 'title' },
    })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('disables stash button when content is empty or already stashed', () => {
    const { rerender } = render(<NotePopup {...defaultProps} initialContent="   " />)
    expect(screen.getByLabelText('Add to Stash')).toBeDisabled()

    stashContextState.current.hasItem = vi.fn(() => true)
    rerender(<NotePopup {...defaultProps} initialContent="Already there" />)
    expect(screen.getByLabelText('Already in Stash')).toBeDisabled()
  })

  it('minimizes, re-expands, and notifies parent', () => {
    const onMinimizeChange = vi.fn()
    render(
      <NotePopup
        {...defaultProps}
        onMinimizeChange={onMinimizeChange}
        initialContent="body"
      />
    )

    fireEvent.click(screen.getByLabelText('Minimize popup'))
    expect(screen.queryByPlaceholderText('Write your note here...')).not.toBeInTheDocument()
    expect(onMinimizeChange).toHaveBeenCalledWith('note_1', true)

    fireEvent.click(screen.getByLabelText('Expand popup'))
    expect(screen.getByPlaceholderText('Write your note here...')).toBeInTheDocument()
    expect(onMinimizeChange).toHaveBeenCalledWith('note_1', false)
  })

  it('repositions minimized popup when stack index changes', () => {
    const { rerender, container } = render(
      <NotePopup {...defaultProps} minimizedStackIndex={0} initialContent="stack" />
    )

    fireEvent.click(screen.getByLabelText('Minimize popup'))
    const popup = container.querySelector('[role="dialog"]') as HTMLElement
    expect(popup.style.top).toBe('740px')

    rerender(<NotePopup {...defaultProps} minimizedStackIndex={2} initialContent="stack" />)
    expect((container.querySelector('[role="dialog"]') as HTMLElement).style.top).toBe('644px')
  })

  it('uses mobile minimized positioning rules', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 375 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: 700 })

    const { container } = render(
      <NotePopup {...defaultProps} minimizedStackIndex={1} initialContent="mobile stack" />
    )
    fireEvent.click(screen.getByLabelText('Minimize popup'))

    const popup = container.querySelector('[role="dialog"]') as HTMLElement
    expect(popup.style.left).toBe('0px')
    expect(popup.style.top).toBe('600px')
  })

  it('closes from close button and Escape key', () => {
    const onClose = vi.fn()
    render(<NotePopup {...defaultProps} onClose={onClose} initialContent="escape" />)

    fireEvent.click(screen.getByLabelText('Close popup'))
    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('drags to stash area, adds note once, and closes', () => {
    const onClose = vi.fn()
    render(<NotePopup {...defaultProps} onClose={onClose} initialContent="drag body" initialTitle="drag title" />)

    const stashSidebar = document.createElement('aside')
    stashSidebar.setAttribute('data-stash-sidebar', 'true')
    stashSidebar.getBoundingClientRect = vi.fn(() => ({
      left: 0,
      top: 0,
      right: 200,
      bottom: 300,
      width: 200,
      height: 300,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect))
    document.body.appendChild(stashSidebar)

    const header = screen.getByText('Note').closest('div') as HTMLElement
    fireEvent.mouseDown(header, { clientX: 140, clientY: 150 })
    fireEvent.mouseMove(document, { clientX: 80, clientY: 100 })
    fireEvent.mouseUp(document, { clientX: 100, clientY: 110 })

    expect(stashContextState.current.setExternalDragHover).toHaveBeenCalledWith(true)
    expect(stashContextState.current.setExternalDragHover).toHaveBeenCalledWith(false)
    expect(stashContextState.current.addItem).toHaveBeenCalledWith({
      type: 'note',
      content: 'drag body',
      metadata: { title: 'drag title' },
    })
    expect(onClose).toHaveBeenCalled()
  })

  it('does not add duplicate when dropped over stash if already stashed', () => {
    stashContextState.current.hasItem = vi.fn(() => true)
    const onClose = vi.fn()
    render(<NotePopup {...defaultProps} onClose={onClose} initialContent="duplicate body" />)

    const stashSidebar = document.createElement('aside')
    stashSidebar.setAttribute('data-stash-sidebar', 'true')
    stashSidebar.getBoundingClientRect = vi.fn(() => ({
      left: 0,
      top: 0,
      right: 200,
      bottom: 300,
      width: 200,
      height: 300,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect))
    document.body.appendChild(stashSidebar)

    const header = screen.getByText('Note').closest('div') as HTMLElement
    fireEvent.mouseDown(header, { clientX: 100, clientY: 100 })
    fireEvent.mouseUp(document, { clientX: 120, clientY: 120 })

    expect(stashContextState.current.addItem).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('resizes from the southeast handle', () => {
    const { container } = render(<NotePopup {...defaultProps} initialContent="resize me" />)
    const popup = container.querySelector('[role="dialog"]') as HTMLElement
    const handle = container.querySelector('[class*="resizeSE"]') as HTMLElement

    expect(handle).toBeInTheDocument()

    fireEvent.mouseDown(handle, { clientX: 300, clientY: 250 })
    fireEvent.mouseMove(document, { clientX: 420, clientY: 340 })
    fireEvent.mouseUp(document)

    expect(parseInt(popup.style.width, 10)).toBeGreaterThan(300)
    expect(parseInt(popup.style.height, 10)).toBeGreaterThan(250)
  })

  it('resizes from northwest handle and updates top/left with all resize handles rendered', () => {
    const { container } = render(<NotePopup {...defaultProps} initialContent="resize nw" />)
    const popup = container.querySelector('[role="dialog"]') as HTMLElement

    const north = container.querySelector('[class*="resizeN"]')
    const south = container.querySelector('[class*="resizeS"]')
    const east = container.querySelector('[class*="resizeE"]')
    const west = container.querySelector('[class*="resizeW"]')
    const northWest = container.querySelector('[class*="resizeNW"]') as HTMLElement
    const northEast = container.querySelector('[class*="resizeNE"]')
    const southWest = container.querySelector('[class*="resizeSW"]')
    const southEast = container.querySelector('[class*="resizeSE"]')

    expect(north).toBeInTheDocument()
    expect(south).toBeInTheDocument()
    expect(east).toBeInTheDocument()
    expect(west).toBeInTheDocument()
    expect(northWest).toBeInTheDocument()
    expect(northEast).toBeInTheDocument()
    expect(southWest).toBeInTheDocument()
    expect(southEast).toBeInTheDocument()

    const initialLeft = parseInt(popup.style.left, 10)
    const initialTop = parseInt(popup.style.top, 10)

    fireEvent.mouseDown(northWest, { clientX: 300, clientY: 250 })
    fireEvent.mouseMove(document, { clientX: 260, clientY: 210 })
    fireEvent.mouseUp(document)

    expect(parseInt(popup.style.left, 10)).toBeLessThanOrEqual(initialLeft)
    expect(parseInt(popup.style.top, 10)).toBeLessThanOrEqual(initialTop)
  })
})
