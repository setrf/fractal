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
})
