import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ConceptPopup, findNonOverlappingPosition } from './ConceptPopup'
import type { ConceptExplanation, ExtractedConcept } from '../../api'
import { extractConcepts } from '../../api'

const stashHarness = vi.hoisted(() => ({
  addItem: vi.fn(),
  hasItem: vi.fn(() => false),
  setExternalDragHover: vi.fn(),
}))

vi.mock('../../context/StashContext', () => ({
  useStashContext: () => stashHarness,
}))

vi.mock('../../api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api')>()
  return {
    ...actual,
    extractConcepts: vi.fn(),
  }
})

vi.mock('../StashButton', () => ({
  StashButton: ({ onClick, isStashed }: { onClick: () => void; isStashed: boolean }) => (
    <button aria-label="stash-explanation" onClick={onClick}>
      {isStashed ? 'stashed' : 'stash'}
    </button>
  ),
}))

vi.mock('../ConceptHighlighter', () => ({
  ConceptHighlighter: ({
    text,
    concepts,
    onConceptClick,
    onConceptRemove,
  }: {
    text: string
    concepts: ExtractedConcept[]
    onConceptClick?: (concept: ExtractedConcept) => void
    onConceptRemove?: (conceptId: string) => void
  }) => (
    <div>
      <span>{text}</span>
      {concepts.map((concept) => (
        <div key={concept.id}>
          <button aria-label={`popup-concept-${concept.id}`} onClick={() => onConceptClick?.(concept)}>
            {concept.text}
          </button>
          {onConceptRemove && (
            <button aria-label={`popup-remove-${concept.id}`} onClick={() => onConceptRemove(concept.id)}>
              remove
            </button>
          )}
        </div>
      ))}
    </div>
  ),
}))

const mockedExtractConcepts = vi.mocked(extractConcepts)

function createConcept(): ExtractedConcept {
  return {
    id: 'c1',
    text: 'dreams',
    normalizedName: 'dreams',
    category: 'science',
    startIndex: 0,
    endIndex: 6,
  }
}

function createExplanation(): ConceptExplanation {
  return {
    conceptId: 'c1',
    normalizedName: 'dreams',
    summary: 'Dreams are cognitive simulations.',
    context: 'They can integrate memory, emotion, and prediction.',
    relatedConcepts: ['Memory', 'Consciousness'],
  }
}

describe('ConceptPopup behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 900 })
    stashHarness.hasItem.mockReturnValue(false)
  })

  it('computes non-overlapping popup placement with viewport clamping', () => {
    const noExisting = findNonOverlappingPosition(-100, -50, [])
    expect(noExisting).toEqual({ x: 20, y: 20 })

    const overlapping = findNonOverlappingPosition(
      120,
      120,
      [{ x: 100, y: 100, width: 320, height: 400 }]
    )

    expect(overlapping.x).toBeGreaterThanOrEqual(20)
    expect(overlapping.y).toBeGreaterThanOrEqual(20)
    expect(overlapping.x).not.toBe(120)
  })

  it('supports dragging and dropping into stash sidebar to persist explanations', () => {
    const onClose = vi.fn()
    const explanation = createExplanation()
    const concept = createConcept()

    const stashSidebar = document.createElement('aside')
    stashSidebar.setAttribute('data-stash-sidebar', 'true')
    stashSidebar.getBoundingClientRect = vi.fn(() => ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 500,
      bottom: 600,
      width: 500,
      height: 600,
      toJSON: () => ({}),
    })) as any
    document.body.appendChild(stashSidebar)

    render(
      <ConceptPopup
        concept={concept}
        explanation={explanation}
        isLoading={false}
        position={{ x: 100, y: 100 }}
        onClose={onClose}
      />
    )

    const header = screen.getByText('dreams').closest('div')
    fireEvent.mouseDown(header!, { clientX: 140, clientY: 140 })
    fireEvent.mouseMove(document, { clientX: 200, clientY: 220 })
    fireEvent.mouseUp(document, { clientX: 240, clientY: 240 })

    expect(stashHarness.setExternalDragHover).toHaveBeenCalledWith(true)
    expect(stashHarness.setExternalDragHover).toHaveBeenLastCalledWith(false)
    expect(stashHarness.addItem).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'explanation',
        content: 'dreams',
      })
    )
    expect(onClose).toHaveBeenCalled()
  })

  it('extracts popup concepts, supports concept click/removal, and reports extraction errors', async () => {
    const explanation = createExplanation()
    const concept = createConcept()
    const onRelatedConceptClick = vi.fn()
    const summaryLength = explanation.summary.length

    mockedExtractConcepts.mockResolvedValueOnce([
      {
        id: 's1',
        text: 'Dreams',
        normalizedName: 'dreams',
        category: 'science',
        startIndex: 0,
        endIndex: 6,
      },
      {
        id: 'k1',
        text: 'memory',
        normalizedName: 'memory',
        category: 'psychology',
        startIndex: summaryLength + 2,
        endIndex: summaryLength + 8,
      },
    ])

    const { rerender } = render(
      <ConceptPopup
        concept={concept}
        explanation={explanation}
        isLoading={false}
        position={{ x: 120, y: 120 }}
        onClose={vi.fn()}
        onRelatedConceptClick={onRelatedConceptClick}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /extract concepts from content/i }))

    await waitFor(() => {
      expect(mockedExtractConcepts).toHaveBeenCalledWith(
        `${explanation.summary}\n\n${explanation.context}`
      )
    })

    fireEvent.click(screen.getByRole('button', { name: 'popup-concept-popup_s1' }))
    expect(onRelatedConceptClick).toHaveBeenCalledWith('dreams')

    fireEvent.click(screen.getByRole('button', { name: 'popup-remove-popup_s1' }))
    expect(screen.queryByRole('button', { name: 'popup-concept-popup_s1' })).not.toBeInTheDocument()

    mockedExtractConcepts.mockRejectedValueOnce(new Error('extract popup failed'))
    rerender(
      <ConceptPopup
        concept={concept}
        explanation={explanation}
        isLoading={false}
        position={{ x: 120, y: 120 }}
        onClose={vi.fn()}
        onRelatedConceptClick={onRelatedConceptClick}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /extract concepts from content/i }))
    expect(await screen.findByText(/extract popup failed/i)).toBeInTheDocument()
  })

  it('supports stashing explanations and minimize state synchronization', async () => {
    const explanation = createExplanation()
    const concept = createConcept()
    const onClose = vi.fn()
    const onMinimizeChange = vi.fn()
    stashHarness.hasItem.mockReturnValue(true)

    const { rerender } = render(
      <ConceptPopup
        concept={concept}
        explanation={explanation}
        isLoading={false}
        position={{ x: 120, y: 120 }}
        onClose={onClose}
        onMinimizeChange={onMinimizeChange}
        externalIsMinimized={true}
      />
    )

    expect(screen.queryByText(/in context/i)).not.toBeInTheDocument()

    rerender(
      <ConceptPopup
        concept={concept}
        explanation={explanation}
        isLoading={false}
        position={{ x: 120, y: 120 }}
        onClose={onClose}
        onMinimizeChange={onMinimizeChange}
        externalIsMinimized={false}
      />
    )

    expect(screen.getByText(/in context/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'stash-explanation' }))
    expect(stashHarness.addItem).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'explanation',
        content: 'dreams',
      })
    )
    expect(onClose).toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /minimize popup/i }))
    await waitFor(() => {
      expect(onMinimizeChange).toHaveBeenCalledWith('c1', true)
    })
  })

  it('creates and removes manual highlights from selected content', async () => {
    const explanation = createExplanation()
    const concept = createConcept()

    render(
      <ConceptPopup
        concept={concept}
        explanation={explanation}
        isLoading={false}
        position={{ x: 120, y: 120 }}
        onClose={vi.fn()}
      />
    )

    const summaryText = screen.getByText(explanation.summary)
    const textNode = summaryText.firstChild as Text
    const selection = window.getSelection()
    const range = document.createRange()
    range.setStart(textNode, 0)
    range.setEnd(textNode, 6)
    selection?.removeAllRanges()
    selection?.addRange(range)

    fireEvent.mouseUp(summaryText)

    const userConcept = await screen.findByRole('button', { name: /popup-concept-user_popup_/i })
    expect(userConcept).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /popup-remove-user_popup_/i }))
    expect(screen.queryByRole('button', { name: /popup-concept-user_popup_/i })).not.toBeInTheDocument()
  })

  it('covers placement fallbacks (initial, right, bottom, left) and ignores minimized blockers', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 760 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 760 })

    const initialFit = findNonOverlappingPosition(
      520,
      520,
      [{ x: 100, y: 100, width: 120, height: 120 }],
      120,
      120
    )
    expect(initialFit).toEqual({ x: 520, y: 520 })

    const rightFallback = findNonOverlappingPosition(
      120,
      120,
      [{ x: 100, y: 100, width: 200, height: 200 }],
      200,
      200
    )
    expect(rightFallback.x).toBeGreaterThan(300)
    expect(rightFallback.y).toBe(120)

    const bottomFallback = findNonOverlappingPosition(
      120,
      120,
      [
        { x: 100, y: 100, width: 200, height: 200 },
        { x: 540, y: 100, width: 200, height: 200 },
      ],
      200,
      200
    )
    expect(bottomFallback.x).toBeGreaterThanOrEqual(20)
    expect(bottomFallback.y).toBeGreaterThanOrEqual(320)

    const leftFallback = findNonOverlappingPosition(
      320,
      120,
      [
        { x: 300, y: 100, width: 200, height: 200 },
        { x: 520, y: 100, width: 200, height: 200 },
        { x: 320, y: 400, width: 200, height: 200 },
      ],
      200,
      200
    )
    expect(leftFallback.x).toBeLessThan(300)

    const minimizedIgnored = findNonOverlappingPosition(
      320,
      120,
      [{ x: 300, y: 100, isMinimized: true }],
      200,
      200
    )
    expect(minimizedIgnored).toEqual({ x: 320, y: 120 })
  })

  it('clamps initial viewport position and supports west/north resize paths', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 640 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 520 })

    const explanation = createExplanation()
    const concept = createConcept()
    const { container } = render(
      <ConceptPopup
        concept={concept}
        explanation={explanation}
        isLoading={false}
        position={{ x: -120, y: -120 }}
        onClose={vi.fn()}
      />
    )

    await waitFor(() => {
      const popup = screen.getByRole('dialog')
      expect(popup.style.left).toBe('20px')
      expect(popup.style.top).toBe('20px')
    })

    const popup = screen.getByRole('dialog')
    const resizeNW = container.querySelector('[class*="resizeNW"]') as HTMLElement
    const resizeN = container.querySelector('[class*="resizeN"]') as HTMLElement
    const resizeS = container.querySelector('[class*="resizeS"]') as HTMLElement
    const resizeE = container.querySelector('[class*="resizeE"]') as HTMLElement
    const resizeW = container.querySelector('[class*="resizeW"]') as HTMLElement
    const resizeNE = container.querySelector('[class*="resizeNE"]') as HTMLElement
    const resizeSW = container.querySelector('[class*="resizeSW"]') as HTMLElement
    const beforeLeft = Number.parseFloat(popup.style.left)
    const beforeTop = Number.parseFloat(popup.style.top)

    fireEvent.mouseDown(resizeNW, { clientX: 120, clientY: 120 })
    fireEvent.mouseMove(document, { clientX: 70, clientY: 60 })
    fireEvent.mouseUp(document)
    fireEvent.mouseDown(resizeN, { clientX: 220, clientY: 100 })
    fireEvent.mouseUp(document)
    fireEvent.mouseDown(resizeS, { clientX: 220, clientY: 320 })
    fireEvent.mouseUp(document)
    fireEvent.mouseDown(resizeE, { clientX: 340, clientY: 220 })
    fireEvent.mouseUp(document)
    fireEvent.mouseDown(resizeW, { clientX: 80, clientY: 220 })
    fireEvent.mouseUp(document)
    fireEvent.mouseDown(resizeNE, { clientX: 340, clientY: 100 })
    fireEvent.mouseUp(document)
    fireEvent.mouseDown(resizeSW, { clientX: 80, clientY: 320 })
    fireEvent.mouseUp(document)

    const afterLeft = Number.parseFloat(popup.style.left)
    const afterTop = Number.parseFloat(popup.style.top)
    expect(afterLeft).toBeLessThan(beforeLeft)
    expect(afterTop).toBeLessThan(beforeTop)
  })

  it('uses mobile minimized stack positions and fallback concept id on minimize callback', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 600 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 500 })

    const onMinimizeChange = vi.fn()
    const concept = createConcept()
    concept.id = ''

    render(
      <ConceptPopup
        concept={concept}
        explanation={createExplanation()}
        isLoading={false}
        position={{ x: 120, y: 120 }}
        onClose={vi.fn()}
        onMinimizeChange={onMinimizeChange}
        minimizedStackIndex={2}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /minimize popup/i }))

    const popup = screen.getByRole('dialog')
    expect(popup.style.left).toBe('0px')
    expect(popup.style.top).toBe('348px')
    expect(onMinimizeChange).toHaveBeenCalledWith('', true)
  })

  it('guards dragging when the target is draggable and avoids stash-drop when explanation is missing', () => {
    const onClose = vi.fn()
    const stashSidebar = document.createElement('aside')
    stashSidebar.setAttribute('data-stash-sidebar', 'true')
    stashSidebar.getBoundingClientRect = vi.fn(() => ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 500,
      bottom: 600,
      width: 500,
      height: 600,
      toJSON: () => ({}),
    })) as any
    document.body.appendChild(stashSidebar)

    const { container } = render(
      <ConceptPopup
        concept={createConcept()}
        explanation={null}
        isLoading={false}
        position={{ x: 120, y: 120 }}
        onClose={onClose}
      />
    )

    const header = container.querySelector('[class*="draggableHeader"]') as HTMLElement
    const draggableChild = document.createElement('div')
    draggableChild.setAttribute('draggable', 'true')
    header.appendChild(draggableChild)

    fireEvent.mouseDown(draggableChild, { clientX: 150, clientY: 160 })
    fireEvent.mouseMove(document, { clientX: 230, clientY: 260 })
    fireEvent.mouseUp(document, { clientX: 230, clientY: 260 })

    expect(stashHarness.addItem).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('handles non-error extraction failure fallback and selection guard branches', async () => {
    mockedExtractConcepts.mockRejectedValueOnce('non-error rejection')

    const explanation = createExplanation()
    render(
      <ConceptPopup
        concept={createConcept()}
        explanation={explanation}
        isLoading={false}
        position={{ x: 120, y: 120 }}
        onClose={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /extract concepts from content/i }))
    expect(await screen.findByText(/failed to extract concepts/i)).toBeInTheDocument()

    const summaryText = screen.getByText(explanation.summary)
    const contextText = screen.getByText(explanation.context)
    const summaryNode = summaryText.firstChild as Text
    const contextNode = contextText.firstChild as Text
    const selection = window.getSelection()

    selection?.removeAllRanges()
    fireEvent.mouseUp(summaryText)

    const shortRange = document.createRange()
    shortRange.setStart(summaryNode, 0)
    shortRange.setEnd(summaryNode, 1)
    selection?.removeAllRanges()
    selection?.addRange(shortRange)
    fireEvent.mouseUp(summaryText)

    const outsideText = document.createTextNode('outside selection text')
    document.body.appendChild(outsideText)
    const outsideRange = document.createRange()
    outsideRange.setStart(outsideText, 0)
    outsideRange.setEnd(outsideText, 7)
    selection?.removeAllRanges()
    selection?.addRange(outsideRange)
    fireEvent.mouseUp(summaryText)

    const mixedRange = document.createRange()
    mixedRange.setStart(summaryNode, 0)
    mixedRange.setEnd(contextNode, 4)
    selection?.removeAllRanges()
    selection?.addRange(mixedRange)
    fireEvent.mouseUp(summaryText)

    const goodRange = document.createRange()
    goodRange.setStart(summaryNode, 0)
    goodRange.setEnd(summaryNode, 6)
    selection?.removeAllRanges()
    selection?.addRange(goodRange)
    fireEvent.mouseUp(summaryText)

    await screen.findByRole('button', { name: /popup-concept-user_popup_/i })

    selection?.removeAllRanges()
    selection?.addRange(goodRange)
    fireEvent.mouseUp(summaryText)

    expect(screen.getAllByRole('button', { name: /popup-concept-user_popup_/i })).toHaveLength(1)
  })

  it('resolves selection offsets when range starts at an element container node', async () => {
    const explanation = createExplanation()

    render(
      <ConceptPopup
        concept={createConcept()}
        explanation={explanation}
        isLoading={false}
        position={{ x: 120, y: 120 }}
        onClose={vi.fn()}
      />
    )

    const summaryText = screen.getByText(explanation.summary)
    const selection = window.getSelection()
    const range = document.createRange()
    range.setStart(summaryText, 0)
    range.setEnd(summaryText.firstChild as Text, 5)
    selection?.removeAllRanges()
    selection?.addRange(range)

    fireEvent.mouseUp(summaryText)

    const created = await screen.findByRole('button', { name: /popup-concept-user_popup_/i })
    expect(created).toBeInTheDocument()
  })

  it('uses default popup dimensions in overlap checks and falls back after cascading overlap', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 420 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 520 })

    const fallback = findNonOverlappingPosition(
      80,
      100,
      [{ x: 80, y: 100 }]
    )

    expect(fallback).toEqual({ x: 80, y: 100 })
  })

  it('supports the cascading success branch in popup placement search', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 246 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 457 })

    const cascade = findNonOverlappingPosition(
      -98,
      310,
      [
        { x: 168, y: 306, width: 320, height: 200 },
        { x: 301, y: 51, width: 320, height: 200 },
        { x: 103, y: 547, width: 20, height: 200 },
        { x: -95, y: 189, width: 20, height: 200 },
      ],
      200,
      40
    )

    expect(cascade).toEqual({ x: 20, y: 229 })
  })

  it('does not close on non-Escape key presses', () => {
    const onClose = vi.fn()
    render(
      <ConceptPopup
        concept={createConcept()}
        explanation={createExplanation()}
        isLoading={false}
        position={{ x: 120, y: 120 }}
        onClose={onClose}
      />
    )

    fireEvent.keyDown(document, { key: 'Enter' })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('covers west/north resize guards when shrinking below minimum size', () => {
    const { container } = render(
      <ConceptPopup
        concept={createConcept()}
        explanation={createExplanation()}
        isLoading={false}
        position={{ x: 200, y: 200 }}
        onClose={vi.fn()}
      />
    )

    const popup = screen.getByRole('dialog')
    const beforeLeft = popup.style.left
    const beforeTop = popup.style.top
    const resizeNW = container.querySelector('[class*="resizeNW"]') as HTMLElement

    fireEvent.mouseDown(resizeNW, { clientX: 220, clientY: 220 })
    fireEvent.mouseMove(document, { clientX: 900, clientY: 900 })
    fireEvent.mouseUp(document)

    expect(popup.style.left).toBe(beforeLeft)
    expect(popup.style.top).toBe(beforeTop)
  })

  it('restores from externally minimized state without pre-minimize position and falls back to empty concept id', async () => {
    const onMinimizeChange = vi.fn()
    const concept = createConcept()
    concept.id = ''

    render(
      <ConceptPopup
        concept={concept}
        explanation={createExplanation()}
        isLoading={false}
        position={{ x: 120, y: 120 }}
        onClose={vi.fn()}
        onMinimizeChange={onMinimizeChange}
        externalIsMinimized={true}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /expand popup/i }))
    await waitFor(() => {
      expect(onMinimizeChange).toHaveBeenCalledWith('', false)
    })
  })

  it('guards extraction re-entry while already extracting', async () => {
    let resolveExtraction: ((value: ExtractedConcept[]) => void) | null = null
    mockedExtractConcepts.mockImplementationOnce(
      () =>
        new Promise<ExtractedConcept[]>((resolve) => {
          resolveExtraction = resolve
        })
    )

    render(
      <ConceptPopup
        concept={createConcept()}
        explanation={createExplanation()}
        isLoading={false}
        position={{ x: 120, y: 120 }}
        onClose={vi.fn()}
      />
    )

    const extractButton = screen.getByRole('button', { name: /extract concepts from content/i }) as HTMLButtonElement
    fireEvent.click(extractButton)

    await waitFor(() => {
      expect(extractButton).toBeDisabled()
    })

    extractButton.disabled = false
    extractButton.removeAttribute('disabled')
    fireEvent.click(extractButton)

    expect(mockedExtractConcepts).toHaveBeenCalledTimes(1)

    resolveExtraction?.([])
    await waitFor(() => {
      expect(extractButton).not.toBeDisabled()
    })
  })

  it('handles popup concept interactions when related callback is missing', async () => {
    mockedExtractConcepts.mockResolvedValueOnce([
      {
        id: 's1',
        text: 'Dreams',
        normalizedName: 'dreams',
        category: 'science',
        startIndex: 0,
        endIndex: 6,
      },
    ])

    render(
      <ConceptPopup
        concept={createConcept()}
        explanation={createExplanation()}
        isLoading={false}
        position={{ x: 120, y: 120 }}
        onClose={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /extract concepts from content/i }))
    const conceptButton = await screen.findByRole('button', { name: 'popup-concept-popup_s1' })
    fireEvent.click(conceptButton)

    expect(conceptButton).toBeInTheDocument()
  })

  it('covers offset null-guard and context-section highlight path during manual selection', async () => {
    const explanation = createExplanation()
    render(
      <ConceptPopup
        concept={createConcept()}
        explanation={explanation}
        isLoading={false}
        position={{ x: 120, y: 120 }}
        onClose={vi.fn()}
      />
    )

    const summaryText = screen.getByText(explanation.summary)
    const selection = window.getSelection()

    const elementOffsetRange = document.createRange()
    elementOffsetRange.setStart(summaryText, 0)
    elementOffsetRange.setEnd(summaryText, 1)
    selection?.removeAllRanges()
    selection?.addRange(elementOffsetRange)
    fireEvent.mouseUp(summaryText)
    expect(screen.queryByRole('button', { name: /popup-concept-user_popup_/i })).not.toBeInTheDocument()

    const contextText = screen.getByText(explanation.context)
    const contextNode = contextText.firstChild as Text
    const contextRange = document.createRange()
    contextRange.setStart(contextNode, 0)
    contextRange.setEnd(contextNode, 6)
    selection?.removeAllRanges()
    selection?.addRange(contextRange)
    fireEvent.mouseUp(contextText)

    const created = await screen.findByRole('button', { name: /popup-concept-user_popup_/i })
    expect(created).toBeInTheDocument()
  })

  it('handles related-concept clicks safely when no related callback is provided', () => {
    render(
      <ConceptPopup
        concept={createConcept()}
        explanation={createExplanation()}
        isLoading={false}
        position={{ x: 120, y: 120 }}
        onClose={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Memory' }))
    expect(screen.getByRole('button', { name: 'Memory' })).toBeInTheDocument()
  })

  it('ignores manual selections from non-summary/context headings', () => {
    const explanation = createExplanation()
    render(
      <ConceptPopup
        concept={createConcept()}
        explanation={explanation}
        isLoading={false}
        position={{ x: 120, y: 120 }}
        onClose={vi.fn()}
      />
    )

    const heading = screen.getByText('In Context')
    const headingNode = heading.firstChild as Text
    const selection = window.getSelection()
    const range = document.createRange()
    range.setStart(headingNode, 0)
    range.setEnd(headingNode, 4)
    selection?.removeAllRanges()
    selection?.addRange(range)

    fireEvent.mouseUp(heading)
    expect(screen.queryByRole('button', { name: /popup-concept-user_popup_/i })).not.toBeInTheDocument()
  })

  it('prevents overlaps against extracted popup concepts and rejects button-text offsets', async () => {
    mockedExtractConcepts.mockResolvedValueOnce([
      {
        id: 's1',
        text: 'Dreams',
        normalizedName: 'dreams',
        category: 'science',
        startIndex: 0,
        endIndex: 6,
      },
    ])

    const explanation = createExplanation()
    render(
      <ConceptPopup
        concept={createConcept()}
        explanation={explanation}
        isLoading={false}
        position={{ x: 120, y: 120 }}
        onClose={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /extract concepts from content/i }))
    const extractedConceptButton = await screen.findByRole('button', { name: 'popup-concept-popup_s1' })

    const summaryText = screen.getByText(explanation.summary)
    const summaryNode = summaryText.firstChild as Text
    const selection = window.getSelection()

    const overlapRange = document.createRange()
    overlapRange.setStart(summaryNode, 0)
    overlapRange.setEnd(summaryNode, 6)
    selection?.removeAllRanges()
    selection?.addRange(overlapRange)
    fireEvent.mouseUp(summaryText)

    expect(screen.queryByRole('button', { name: /popup-concept-user_popup_/i })).not.toBeInTheDocument()

    const buttonTextNode = extractedConceptButton.firstChild as Text
    const buttonRange = document.createRange()
    buttonRange.setStart(summaryNode, 0)
    buttonRange.setEnd(buttonTextNode, buttonTextNode.textContent?.length ?? 0)
    selection?.removeAllRanges()
    selection?.addRange(buttonRange)
    fireEvent.mouseUp(summaryText)

    expect(screen.queryByRole('button', { name: /popup-concept-user_popup_/i })).not.toBeInTheDocument()
  })

  it('covers synthetic selection fallbacks for orphan start nodes and collapsed adjusted offsets', () => {
    const explanation = createExplanation()
    render(
      <ConceptPopup
        concept={createConcept()}
        explanation={explanation}
        isLoading={false}
        position={{ x: 120, y: 120 }}
        onClose={vi.fn()}
      />
    )

    const summaryText = screen.getByText(explanation.summary)
    const summaryNode = summaryText.firstChild as Text
    const realGetSelection = window.getSelection
    const orphanTextNode = document.createTextNode('orphan')

    const orphanStartRange = {
      commonAncestorContainer: summaryText,
      startContainer: orphanTextNode,
      startOffset: 0,
      endContainer: summaryNode,
      endOffset: 2,
    } as unknown as Range
    const orphanSelection = {
      isCollapsed: false,
      toString: () => 'ab',
      getRangeAt: () => orphanStartRange,
      removeAllRanges: vi.fn(),
    } as unknown as Selection
    Object.defineProperty(window, 'getSelection', {
      configurable: true,
      value: () => orphanSelection,
    })
    fireEvent.mouseUp(summaryText)

    const collapsedOffsetsRange = {
      commonAncestorContainer: summaryNode,
      startContainer: summaryNode,
      startOffset: 3,
      endContainer: summaryNode,
      endOffset: 3,
    } as unknown as Range
    const collapsedOffsetsSelection = {
      isCollapsed: false,
      toString: () => 'ab',
      getRangeAt: () => collapsedOffsetsRange,
      removeAllRanges: vi.fn(),
    } as unknown as Selection
    Object.defineProperty(window, 'getSelection', {
      configurable: true,
      value: () => collapsedOffsetsSelection,
    })
    fireEvent.mouseUp(summaryText)

    Object.defineProperty(window, 'getSelection', {
      configurable: true,
      value: realGetSelection,
    })

    expect(screen.queryByRole('button', { name: /popup-concept-user_popup_/i })).not.toBeInTheDocument()
  })
})
