import { createEvent, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
    className,
    onConceptHover,
    onConceptLeave,
    onConceptClick,
    onConceptRemove,
  }: {
    text: string
    concepts: ExtractedConcept[]
    className?: string
    onConceptHover?: (concept: ExtractedConcept, event: React.MouseEvent) => void
    onConceptLeave?: () => void
    onConceptClick?: (concept: ExtractedConcept, event: React.MouseEvent) => void
    onConceptRemove?: (conceptId: string) => void
  }) => (
    <div className={className}>
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
      makeConcept('c3', 'outcomes', 35, 43),
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
    fireEvent.mouseLeave(firstConcept)
    expect(onConceptHover).toHaveBeenCalledWith(concepts[0], node.text)
    expect(screen.getAllByTestId('popup-card')).toHaveLength(1)

    fireEvent.mouseEnter(firstConcept, { clientX: 20, clientY: 30 })
    expect(screen.getAllByTestId('popup-card')).toHaveLength(1)

    fireEvent.mouseEnter(screen.getByRole('button', { name: 'concept-c3' }), { clientX: 60, clientY: 70 })
    expect(screen.getAllByTestId('popup-card')).toHaveLength(2)

    fireEvent.click(screen.getByRole('button', { name: 'concept-c2' }), { clientX: 80, clientY: 90 })
    expect(onConceptClick).toHaveBeenCalledWith(concepts[1], node.text)
    expect(screen.getAllByTestId('popup-card')).toHaveLength(3)
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
    expect(screen.getByText('Stack:c2:2')).toBeInTheDocument()

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

  it('covers keyboard guard branches for defaultPrevented and non-activation keys', () => {
    const node = createQuestionNode('How does curiosity affect learning outcomes?')
    const onSelect = vi.fn()

    render(<QuestionNode node={node} onSelect={onSelect} />)

    const nodeButton = screen.getByRole('button', { name: `Question: ${node.text}` })

    const prevented = createEvent.keyDown(nodeButton, { key: 'Enter', bubbles: true, cancelable: true })
    prevented.preventDefault()
    fireEvent(nodeButton, prevented)

    fireEvent.keyDown(nodeButton, { key: 'Escape' })

    expect(onSelect).not.toHaveBeenCalled()
  })

  it('covers normalized-name popup dedupe and legacy popup fallback props', () => {
    const node = createQuestionNode('How does curiosity affect learning outcomes?')
    const concepts = [
      makeConcept('c1', 'curiosity', 9, 18, 'curiosity'),
      makeConcept('c1-alias', 'Curiosity', 9, 18, 'curiosity'),
    ]
    const onConceptClick = vi.fn()

    render(
      <QuestionNode
        node={node}
        concepts={concepts}
        onConceptClick={onConceptClick}
        conceptExplanation={{
          conceptId: 'c1',
          normalizedName: 'curiosity',
          definition: 'legacy fallback',
          category: 'abstract',
          confidence: 0.4,
          relatedConcepts: [],
        }}
        isConceptLoading
        conceptError="legacy error"
      />
    )

    fireEvent.mouseEnter(screen.getByRole('button', { name: 'concept-c1' }), { clientX: 15, clientY: 25 })
    expect(screen.getAllByTestId('popup-card')).toHaveLength(1)
    expect(screen.getByText('Loading:true')).toBeInTheDocument()
    expect(screen.getByText('Error:legacy error')).toBeInTheDocument()

    // Different id but same normalizedName should dedupe.
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'concept-c1-alias' }), { clientX: 16, clientY: 26 })
    expect(screen.getAllByTestId('popup-card')).toHaveLength(1)

    // Related concept dedupe path.
    fireEvent.click(screen.getByRole('button', { name: 'related-popup-c1' }))
    const popupCount = screen.getAllByTestId('popup-card').length
    fireEvent.click(screen.getByRole('button', { name: 'related-popup-c1' }))
    expect(screen.getAllByTestId('popup-card')).toHaveLength(popupCount)
  })

  it('covers element-container selection offsets, overlap true/false, and button-text rejection', async () => {
    const node = createQuestionNode('Curiosity improves learning outcomes')
    const onAddUserConcept = vi.fn()

    render(
      <QuestionNode
        node={node}
        concepts={[makeConcept('existing', 'improves', 10, 18)]}
        onAddUserConcept={onAddUserConcept}
      />
    )

    const textElement = screen.getByText(node.text)
    const textNode = textElement.firstChild as Text

    // Element container -> child text-node path (line 447 true branch).
    const elementRange = document.createRange()
    elementRange.setStart(textElement, 0)
    elementRange.setEnd(textNode, 8)
    window.getSelection()?.removeAllRanges()
    window.getSelection()?.addRange(elementRange)
    fireEvent.mouseUp(textElement)

    await waitFor(() => {
      expect(onAddUserConcept).toHaveBeenCalledTimes(1)
    })

    // Overlap path should prevent callback.
    selectText(textNode, 12, 16)
    fireEvent.mouseUp(textElement)
    expect(onAddUserConcept).toHaveBeenCalledTimes(1)

    // Non-text child path (line 447 false arm).
    const wrapper = textElement.parentElement as HTMLElement
    const nonTextRange = document.createRange()
    nonTextRange.setStart(wrapper, 1)
    nonTextRange.setEnd(textNode, 5)
    window.getSelection()?.removeAllRanges()
    window.getSelection()?.addRange(nonTextRange)
    fireEvent.mouseUp(textElement)
    expect(onAddUserConcept).toHaveBeenCalledTimes(1)

    // Button text should be rejected by the tree walker.
    const conceptButtonText = screen.getByRole('button', { name: 'concept-existing' }).firstChild as Text
    const buttonRange = document.createRange()
    buttonRange.setStart(conceptButtonText, 0)
    buttonRange.setEnd(conceptButtonText, conceptButtonText.length)
    window.getSelection()?.removeAllRanges()
    window.getSelection()?.addRange(buttonRange)
    fireEvent.mouseUp(textElement)
    expect(onAddUserConcept).toHaveBeenCalledTimes(1)
  })

  it('covers click-dedupe guard and additional selection walker/fallback branches', async () => {
    const node = createQuestionNode('Curiosity improves learning outcomes')
    const concept = makeConcept('c1', 'curiosity', 50, 59, 'curiosity')
    const onConceptClick = vi.fn()
    const onAddUserConcept = vi.fn()

    render(
      <QuestionNode
        node={node}
        concepts={[concept]}
        onConceptClick={onConceptClick}
        onAddUserConcept={onAddUserConcept}
      />
    )

    // Local click dedupe branch (existing popup early return).
    fireEvent.click(screen.getByRole('button', { name: 'concept-c1' }), { clientX: 44, clientY: 55 })
    expect(screen.getAllByTestId('popup-card')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'concept-c1' }), { clientX: 46, clientY: 57 })
    expect(screen.getAllByTestId('popup-card')).toHaveLength(1)
    expect(onConceptClick).toHaveBeenCalledTimes(1)

    const textElement = screen.getByText(node.text)
    const textNode = textElement.firstChild as Text
    const textRoot = textElement.parentElement as HTMLElement

    // Ensure walker visits a non-target text node first (line 476 truthy arm).
    const prefixNode = document.createTextNode('xx')
    textRoot.insertBefore(prefixNode, textElement)
    selectText(textNode, 0, 8)
    fireEvent.mouseUp(textElement)

    // Ensure walker sees empty text before target (line 476 fallback arm)
    // and target empty node (line 473 fallback arm).
    const emptyNode = document.createTextNode('')
    textRoot.insertBefore(emptyNode, textRoot.firstChild)
    const selection = window.getSelection()
    const emptyStartRange = document.createRange()
    emptyStartRange.setStart(emptyNode, 0)
    emptyStartRange.setEnd(textNode, 5)
    selection?.removeAllRanges()
    selection?.addRange(emptyStartRange)
    fireEvent.mouseUp(textElement)

    // getTextOffset non-text-child failure path + null-offset guard.
    const invalidOffsetRange = document.createRange()
    invalidOffsetRange.setStart(textElement, 1)
    invalidOffsetRange.setEnd(textNode, 5)
    selection?.removeAllRanges()
    selection?.addRange(invalidOffsetRange)
    fireEvent.mouseUp(textElement)

    // Non-text child selected from text root (child exists but is not a text node).
    const nonTextChildRange = document.createRange()
    nonTextChildRange.setStart(textRoot, 0)
    nonTextChildRange.setEnd(textNode, 5)
    selection?.removeAllRanges()
    selection?.addRange(nonTextChildRange)
    fireEvent.mouseUp(textElement)

    // Force end<=start branch with a mocked non-collapsed selection.
    const realGetSelection = window.getSelection
    const syntheticRange = document.createRange()
    syntheticRange.setStart(textNode, 3)
    syntheticRange.setEnd(textNode, 3)
    const syntheticSelection = {
      isCollapsed: false,
      toString: () => 'ab',
      getRangeAt: () => syntheticRange,
      removeAllRanges: vi.fn(),
    } as unknown as Selection
    Object.defineProperty(window, 'getSelection', {
      configurable: true,
      value: () => syntheticSelection,
    })
    fireEvent.mouseUp(textElement)
    Object.defineProperty(window, 'getSelection', {
      configurable: true,
      value: realGetSelection,
    })

    expect(onAddUserConcept.mock.calls.length).toBeGreaterThanOrEqual(1)
  })

  it('permits valid selection without callback and no-ops on add branch', () => {
    const node = createQuestionNode('Curiosity improves learning outcomes')
    render(<QuestionNode node={node} onConceptClick={vi.fn()} />)

    const textElement = screen.getByText(node.text)
    const textNode = textElement.firstChild as Text
    const realGetSelection = window.getSelection
    const syntheticRange = document.createRange()
    syntheticRange.setStart(textNode, 0)
    syntheticRange.setEnd(textNode, 9)
    const syntheticSelection = {
      isCollapsed: false,
      toString: () => 'Curiosity',
      getRangeAt: () => syntheticRange,
      removeAllRanges: vi.fn(),
    } as unknown as Selection
    Object.defineProperty(window, 'getSelection', {
      configurable: true,
      value: () => syntheticSelection,
    })
    fireEvent.mouseUp(textElement)
    Object.defineProperty(window, 'getSelection', {
      configurable: true,
      value: realGetSelection,
    })

    // No callback; test passes by executing branch without throwing.
    expect(screen.getByText(node.text)).toBeInTheDocument()
  })

  it('covers non-text child offset rejection and callback-omitted highlight creation path', () => {
    const node = createQuestionNode('Curiosity improves learning outcomes')
    render(<QuestionNode node={node} onConceptClick={vi.fn()} />)

    const textElement = screen.getByText(node.text)
    const textNode = textElement.firstChild as Text
    const textRoot = textElement.parentElement as HTMLElement

    const nonTextChild = document.createElement('span')
    nonTextChild.textContent = 'prefix'
    textRoot.insertBefore(nonTextChild, textElement)

    const selection = window.getSelection()

    // Child exists but is not a text node -> getTextOffset should reject.
    const nonTextStart = document.createRange()
    nonTextStart.setStart(textRoot, 0)
    nonTextStart.setEnd(textNode, 5)
    selection?.removeAllRanges()
    selection?.addRange(nonTextStart)
    fireEvent.mouseUp(textElement)

    // Valid range with no onAddUserConcept callback should still execute safely.
    const valid = document.createRange()
    valid.setStart(textNode, 0)
    valid.setEnd(textNode, 8)
    selection?.removeAllRanges()
    selection?.addRange(valid)
    fireEvent.mouseUp(textElement)

    expect(screen.getByText(node.text)).toBeInTheDocument()
  })

  it('rejects element-offset selections when the offset points to a non-text child node', () => {
    const node = createQuestionNode('Curiosity improves learning outcomes')
    const onAddUserConcept = vi.fn()
    const concept = makeConcept('existing', 'improves', 10, 18)

    render(
      <QuestionNode
        node={node}
        concepts={[concept]}
        onAddUserConcept={onAddUserConcept}
      />
    )

    const textElement = screen.getByText(node.text)
    const textNode = textElement.firstChild as Text
    const conceptRow = screen.getByRole('button', { name: 'concept-existing' }).parentElement as HTMLElement
    const root = conceptRow.parentElement as HTMLElement
    const conceptRowIndex = Array.from(root.childNodes).findIndex((child) => child === conceptRow)
    expect(conceptRowIndex).toBeGreaterThanOrEqual(0)

    const range = document.createRange()
    range.setStart(root, conceptRowIndex)
    range.setEnd(textNode, 4)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)

    fireEvent.mouseUp(textElement)
    expect(onAddUserConcept).not.toHaveBeenCalled()
  })

  it('covers non-text child offset fallback via synthetic selection on the text root', () => {
    const node = createQuestionNode('Curiosity improves learning outcomes')
    const onAddUserConcept = vi.fn()

    render(
      <QuestionNode
        node={node}
        concepts={[makeConcept('existing', 'improves', 10, 18)]}
        onAddUserConcept={onAddUserConcept}
      />
    )

    const textElement = screen.getByText(node.text)
    const textNode = textElement.firstChild as Text
    const textRoot = textElement.parentElement as HTMLElement
    const realGetSelection = window.getSelection
    const syntheticRange = {
      commonAncestorContainer: textRoot,
      startContainer: textRoot,
      startOffset: 1,
      endContainer: textNode,
      endOffset: 5,
    } as unknown as Range
    const syntheticSelection = {
      isCollapsed: false,
      toString: () => 'Curio',
      getRangeAt: () => syntheticRange,
      removeAllRanges: vi.fn(),
    } as unknown as Selection

    Object.defineProperty(window, 'getSelection', {
      configurable: true,
      value: () => syntheticSelection,
    })
    fireEvent.mouseUp(textElement)
    Object.defineProperty(window, 'getSelection', {
      configurable: true,
      value: realGetSelection,
    })

    expect(onAddUserConcept).not.toHaveBeenCalled()
  })
})
