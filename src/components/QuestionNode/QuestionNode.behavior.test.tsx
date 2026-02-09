import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QuestionNode } from './QuestionNode'
import { createQuestionNode } from '../../types/question'
import type { ExtractedConcept } from '../../api'

const stashHarness = vi.hoisted(() => ({
  addItem: vi.fn(),
  hasItem: vi.fn(() => false),
}))

let isMobile = false

vi.mock('../../context/StashContext', () => ({
  useStashContext: () => stashHarness,
}))

vi.mock('../../hooks/useIsMobile', () => ({
  useIsMobile: () => isMobile,
}))

vi.mock('../StashButton', () => ({
  StashButton: ({ onClick, isStashed }: { onClick: () => void; isStashed: boolean }) => (
    <button aria-label="stash-question" onClick={onClick}>
      {isStashed ? 'stashed' : 'stash'}
    </button>
  ),
}))

vi.mock('../ConceptHighlighter', () => ({
  ConceptHighlighter: ({
    text,
    concepts,
    onConceptHover,
    onConceptLeave,
    onConceptClick,
    onConceptRemove,
  }: {
    text: string
    concepts: ExtractedConcept[]
    onConceptHover?: (concept: ExtractedConcept, event: React.MouseEvent) => void
    onConceptLeave?: () => void
    onConceptClick?: (concept: ExtractedConcept, event: React.MouseEvent) => void
    onConceptRemove?: (conceptId: string) => void
  }) => (
    <div>
      <span>{text}</span>
      {concepts.map((concept) => (
        <div key={concept.id}>
          <button
            aria-label={`concept-${concept.id}`}
            onMouseEnter={(event) => onConceptHover?.(concept, event)}
            onMouseLeave={() => onConceptLeave?.()}
            onClick={(event) => onConceptClick?.(concept, event)}
          >
            {concept.text}
          </button>
          {onConceptRemove && (
            <button aria-label={`remove-concept-${concept.id}`} onClick={() => onConceptRemove(concept.id)}>
              remove
            </button>
          )}
        </div>
      ))}
    </div>
  ),
}))

vi.mock('../ConceptPopup', () => ({
  ConceptPopup: ({
    concept,
    onClose,
    onRelatedConceptClick,
    onMinimizeChange,
    minimizedStackIndex,
    isLoading,
    error,
  }: {
    concept: ExtractedConcept
    onClose: () => void
    onRelatedConceptClick?: (conceptName: string) => void
    onMinimizeChange?: (conceptId: string, minimized: boolean) => void
    minimizedStackIndex: number
    isLoading?: boolean
    error?: string | null
  }) => (
    <div data-testid="popup-card">
      <div>{`Popup:${concept.id}:${concept.text}`}</div>
      <div>{`Stack:${concept.id}:${minimizedStackIndex}`}</div>
      <div>{`Loading:${String(Boolean(isLoading))}`}</div>
      <div>{`Error:${error ?? ''}`}</div>
      <button aria-label={`close-popup-${concept.id}`} onClick={onClose}>
        close popup
      </button>
      <button aria-label={`related-popup-${concept.id}`} onClick={() => onRelatedConceptClick?.('Related Topic')}>
        related concept
      </button>
      <button aria-label={`minimize-popup-${concept.id}`} onClick={() => onMinimizeChange?.(concept.id, true)}>
        minimize popup
      </button>
    </div>
  ),
  findNonOverlappingPosition: (x: number, y: number) => ({ x, y }),
  DEFAULT_POPUP_WIDTH: 360,
  DEFAULT_POPUP_HEIGHT: 320,
}))

function makeConcept(id: string, text: string, startIndex: number, endIndex: number, normalizedName = text.toLowerCase()): ExtractedConcept {
  return {
    id,
    text,
    normalizedName,
    category: 'abstract',
    startIndex,
    endIndex,
  }
}

function selectText(node: Node, start: number, end: number) {
  const selection = window.getSelection()
  if (!selection) return
  selection.removeAllRanges()
  const range = document.createRange()
  range.setStart(node, start)
  range.setEnd(node, end)
  selection.addRange(range)
}

describe('QuestionNode behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isMobile = false
    stashHarness.hasItem.mockReturnValue(false)
  })

  it('manages local popups including dedupe, minimize trigger, related concepts, and close-all', async () => {
    const node = createQuestionNode('How does curiosity affect learning outcomes?')
    const concepts = [
      makeConcept('c1', 'curiosity', 9, 18),
      makeConcept('c2', 'learning', 26, 34),
    ]
    const onConceptHover = vi.fn()
    const onConceptClick = vi.fn()

    const { rerender } = render(
      <QuestionNode
        node={node}
        concepts={concepts}
        onConceptHover={onConceptHover}
        onConceptClick={onConceptClick}
        conceptLoadingStates={{ c2: { isLoading: true, error: 'fetch failed' } }}
      />
    )

    const firstConcept = screen.getByRole('button', { name: 'concept-c1' })
    fireEvent.mouseEnter(firstConcept, { clientX: 20, clientY: 30 })
    expect(onConceptHover).toHaveBeenCalledWith(concepts[0], node.text)
    expect(screen.getAllByTestId('popup-card')).toHaveLength(1)

    fireEvent.mouseEnter(firstConcept, { clientX: 20, clientY: 30 })
    expect(screen.getAllByTestId('popup-card')).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: 'concept-c2' }), { clientX: 80, clientY: 90 })
    expect(onConceptClick).toHaveBeenCalledWith(concepts[1], node.text)
    expect(screen.getAllByTestId('popup-card')).toHaveLength(2)
    expect(screen.getByText('Loading:true')).toBeInTheDocument()
    expect(screen.getByText('Error:fetch failed')).toBeInTheDocument()
    expect(screen.getByText('Stack:c2:0')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'minimize-popup-c2' }))
    expect(screen.getByText('Stack:c2:0')).toBeInTheDocument()

    rerender(
      <QuestionNode
        node={node}
        concepts={concepts}
        onConceptHover={onConceptHover}
        onConceptClick={onConceptClick}
        conceptLoadingStates={{ c2: { isLoading: true, error: 'fetch failed' } }}
        minimizeAllTrigger={1}
      />
    )
    expect(screen.getByText('Stack:c2:1')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'related-popup-c1' }))
    expect(screen.getAllByTestId('popup-card').length).toBeGreaterThanOrEqual(3)
    expect(onConceptClick).toHaveBeenLastCalledWith(
      expect.objectContaining({ normalizedName: 'related topic' }),
      node.text
    )

    fireEvent.click(screen.getByRole('button', { name: 'close-popup-c1' }))
    expect(screen.queryByText(/Popup:c1:/)).not.toBeInTheDocument()

    rerender(
      <QuestionNode
        node={node}
        concepts={concepts}
        onConceptHover={onConceptHover}
        onConceptClick={onConceptClick}
        closeAllTrigger={1}
      />
    )
    expect(screen.queryByTestId('popup-card')).not.toBeInTheDocument()
  })

  it('delegates popup actions to onOpenPopup when provided', () => {
    const node = createQuestionNode('How does curiosity affect learning outcomes?')
    const concept = makeConcept('c1', 'curiosity', 9, 18)
    const onOpenPopup = vi.fn()
    const onConceptHover = vi.fn()
    const onConceptClick = vi.fn()

    render(
      <QuestionNode
        node={node}
        concepts={[concept]}
        onOpenPopup={onOpenPopup}
        onConceptHover={onConceptHover}
        onConceptClick={onConceptClick}
      />
    )

    const conceptButton = screen.getByRole('button', { name: 'concept-c1' })
    fireEvent.mouseEnter(conceptButton, { clientX: 10, clientY: 20 })
    fireEvent.click(conceptButton, { clientX: 30, clientY: 40 })

    expect(onOpenPopup).toHaveBeenCalledTimes(2)
    expect(onOpenPopup).toHaveBeenCalledWith(concept, { x: 20, y: 30 })
    expect(onOpenPopup).toHaveBeenCalledWith(concept, { x: 40, y: 50 })
    expect(onConceptHover).toHaveBeenCalledWith(concept, node.text)
    expect(onConceptClick).toHaveBeenCalledWith(concept, node.text)
    expect(screen.queryByTestId('popup-card')).not.toBeInTheDocument()
  })

  it('adds user concepts from text selection and blocks overlapping selections', async () => {
    const node = createQuestionNode('Curiosity improves learning outcomes')
    const onAddUserConcept = vi.fn()

    const { rerender } = render(
      <QuestionNode
        node={node}
        onAddUserConcept={onAddUserConcept}
      />
    )

    const textElement = screen.getByText(node.text)
    const textNode = textElement.firstChild as Text

    selectText(textNode, 10, 18)
    fireEvent.mouseUp(textElement)

    await waitFor(() => {
      expect(onAddUserConcept).toHaveBeenCalledTimes(1)
      expect(onAddUserConcept).toHaveBeenCalledWith(
        node.id,
        expect.objectContaining({
          text: 'improves',
          normalizedName: 'improves',
          startIndex: 10,
          endIndex: 18,
        })
      )
    })

    rerender(
      <QuestionNode
        node={node}
        onAddUserConcept={onAddUserConcept}
        concepts={[makeConcept('existing', 'improves', 10, 18)]}
      />
    )

    selectText(textNode, 10, 18)
    fireEvent.mouseUp(textElement)
    expect(onAddUserConcept).toHaveBeenCalledTimes(1)
  })

  it('handles selection guard paths (collapsed, short, outside, and unresolved offsets)', () => {
    const node = createQuestionNode('Curiosity improves learning outcomes')
    const onAddUserConcept = vi.fn()

    render(
      <QuestionNode
        node={node}
        onAddUserConcept={onAddUserConcept}
      />
    )

    const textElement = screen.getByText(node.text)
    const textNode = textElement.firstChild as Text

    // No selection / collapsed
    window.getSelection()?.removeAllRanges()
    fireEvent.mouseUp(textElement)

    // Too-short selection
    selectText(textNode, 0, 1)
    fireEvent.mouseUp(textElement)

    // Selection outside component
    const outside = document.createElement('div')
    outside.textContent = 'outside text'
    document.body.appendChild(outside)
    const outsideRange = document.createRange()
    outsideRange.setStart(outside.firstChild as Text, 0)
    outsideRange.setEnd(outside.firstChild as Text, 7)
    window.getSelection()?.removeAllRanges()
    window.getSelection()?.addRange(outsideRange)
    fireEvent.mouseUp(textElement)

    // Range from element container with no text child at offset -> unresolved offsets
    const unresolvedRange = document.createRange()
    unresolvedRange.setStart(textElement, 1)
    unresolvedRange.setEnd(textElement, 1)
    window.getSelection()?.removeAllRanges()
    window.getSelection()?.addRange(unresolvedRange)
    fireEvent.mouseUp(textElement)

    expect(onAddUserConcept).not.toHaveBeenCalled()
  })

  it('wires concept removal, stash action, AI generation, and lock-in actions', async () => {
    const node = createQuestionNode('How does curiosity affect learning outcomes?')
    const concept = makeConcept('c1', 'curiosity', 9, 18)
    const onRemoveConcept = vi.fn()
    const onGenerateAI = vi.fn()
    const onLockIn = vi.fn()
    stashHarness.hasItem.mockReturnValue(true)
    isMobile = true

    render(
      <QuestionNode
        node={node}
        concepts={[concept]}
        onRemoveConcept={onRemoveConcept}
        onGenerateAI={onGenerateAI}
        onLockIn={onLockIn}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'remove-concept-c1' }))
    expect(onRemoveConcept).toHaveBeenCalledWith(node.id, 'c1')

    fireEvent.click(screen.getByRole('button', { name: 'stash-question' }))
    expect(stashHarness.addItem).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'question',
        content: node.text,
        metadata: expect.objectContaining({ questionId: node.id }),
      })
    )

    fireEvent.click(screen.getByRole('button', { name: /generate ai suggestions/i }))
    expect(onGenerateAI).toHaveBeenCalledWith(node.id, node.text)

    fireEvent.click(screen.getByRole('button', { name: /chat about this question/i }))
    expect(onLockIn).toHaveBeenCalledWith(node.id, node.text)

    expect(screen.queryByText('Deep dive')).not.toBeInTheDocument()
    expect(screen.queryByText('Chat')).not.toBeInTheDocument()
  })
})
