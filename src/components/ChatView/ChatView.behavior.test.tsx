import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ChatView } from './ChatView'
import type { ExtractedConcept } from '../../api'

const stashHarness = vi.hoisted(() => ({
  addItem: vi.fn(),
  hasItem: vi.fn(() => false),
}))

vi.mock('../../context/StashContext', () => ({
  useStashContext: () => stashHarness,
}))

vi.mock('../StashButton', () => ({
  StashButton: ({ onClick, isStashed }: { onClick: () => void; isStashed: boolean }) => (
    <button aria-label="stash-message" onClick={onClick}>
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
  }: {
    text: string
    concepts: ExtractedConcept[]
    onConceptHover?: (concept: ExtractedConcept, event: React.MouseEvent) => void
    onConceptLeave?: () => void
    onConceptClick?: (concept: ExtractedConcept, event: React.MouseEvent) => void
  }) => (
    <div>
      <span>{text}</span>
      {concepts.map((concept) => (
        <button
          key={concept.id}
          aria-label={`concept-${concept.id}`}
          onMouseEnter={(event) => onConceptHover?.(concept, event)}
          onMouseLeave={() => onConceptLeave?.()}
          onClick={(event) => onConceptClick?.(concept, event)}
        >
          {concept.text}
        </button>
      ))}
    </div>
  ),
}))

vi.mock('../MarkdownWithHighlights', () => ({
  MarkdownWithHighlights: ({
    content,
    concepts,
    onConceptHover,
    onConceptLeave,
    onConceptClick,
    onConceptRemove,
  }: {
    content: string
    concepts: ExtractedConcept[]
    onConceptHover?: (concept: ExtractedConcept, event: React.MouseEvent) => void
    onConceptLeave?: () => void
    onConceptClick?: (concept: ExtractedConcept, event: React.MouseEvent) => void
    onConceptRemove?: (conceptId: string) => void
  }) => (
    <div data-testid="markdown-block">
      <span>{content}</span>
      <div>
        {concepts.length > 0
          ? concepts.map((concept) => `${concept.text}@${concept.startIndex}-${concept.endIndex}`).join('|')
          : 'no-concepts'}
      </div>
      {concepts[0] && (
        <>
          <button
            aria-label={`hover-markdown-${concepts[0].id}`}
            onMouseEnter={(event) => onConceptHover?.(concepts[0], event)}
            onMouseLeave={() => onConceptLeave?.()}
          >
            hover markdown concept
          </button>
          <button
            aria-label={`click-markdown-${concepts[0].id}`}
            onClick={(event) => onConceptClick?.(concepts[0], event)}
          >
            click markdown concept
          </button>
          <button aria-label="remove-first-concept" onClick={() => onConceptRemove?.(concepts[0].id)}>
            remove concept
          </button>
        </>
      )}
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
      <button aria-label={`related-popup-${concept.id}`} onClick={() => onRelatedConceptClick?.('Related Idea')}>
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

const question = 'How do ideas evolve in learning systems?'
const initialPrompt = 'Help me explore and understand this question.'

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

describe('ChatView behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    stashHarness.hasItem.mockReturnValue(false)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('manages local popup lifecycle including dedupe, related concepts, minimize, and close-all trigger', async () => {
    const concepts = [
      makeConcept('c1', 'ideas', 7, 12),
      makeConcept('c2', 'learning', 27, 35),
    ]
    const onConceptHover = vi.fn()
    const onConceptClick = vi.fn()

    const { rerender } = render(
      <ChatView
        question={question}
        onBack={vi.fn()}
        onSendMessage={vi.fn().mockResolvedValue('Assistant response')}
        concepts={concepts}
        onConceptHover={onConceptHover}
        onConceptClick={onConceptClick}
      />
    )

    await screen.findByText('Assistant response')

    const firstConcept = screen.getByRole('button', { name: 'concept-c1' })
    fireEvent.mouseEnter(firstConcept, { clientX: 40, clientY: 50 })
    expect(onConceptHover).toHaveBeenCalledWith(concepts[0], question)
    expect(screen.getAllByTestId('popup-card')).toHaveLength(1)

    fireEvent.mouseEnter(firstConcept, { clientX: 40, clientY: 50 })
    expect(screen.getAllByTestId('popup-card')).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: 'concept-c2' }), { clientX: 80, clientY: 90 })
    expect(onConceptClick).toHaveBeenCalledWith(concepts[1], question)
    expect(screen.getAllByTestId('popup-card')).toHaveLength(2)

    fireEvent.click(screen.getByRole('button', { name: 'minimize-popup-c1' }))
    expect(screen.getByText('Stack:c2:1')).toBeInTheDocument()

    rerender(
      <ChatView
        question={question}
        onBack={vi.fn()}
        onSendMessage={vi.fn().mockResolvedValue('Assistant response')}
        concepts={concepts}
        onConceptHover={onConceptHover}
        onConceptClick={onConceptClick}
        minimizeAllTrigger={1}
      />
    )
    expect(screen.getByText('Stack:c2:1')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'related-popup-c1' }))
    expect(screen.getAllByTestId('popup-card').length).toBeGreaterThanOrEqual(3)
    expect(onConceptClick).toHaveBeenLastCalledWith(
      expect.objectContaining({ normalizedName: 'related idea' }),
      question
    )

    fireEvent.click(screen.getByRole('button', { name: 'close-popup-c2' }))
    expect(screen.queryByText(/Popup:c2:/)).not.toBeInTheDocument()

    rerender(
      <ChatView
        question={question}
        onBack={vi.fn()}
        onSendMessage={vi.fn().mockResolvedValue('Assistant response')}
        concepts={concepts}
        onConceptHover={onConceptHover}
        onConceptClick={onConceptClick}
        closeAllTrigger={1}
      />
    )

    expect(screen.queryByTestId('popup-card')).not.toBeInTheDocument()
  })

  it('delegates popup handling to parent when onOpenPopup is provided', async () => {
    const concept = makeConcept('c1', 'ideas', 7, 12)
    const onOpenPopup = vi.fn()
    const onConceptHover = vi.fn()
    const onConceptClick = vi.fn()

    render(
      <ChatView
        question={question}
        onBack={vi.fn()}
        onSendMessage={vi.fn().mockResolvedValue('Assistant response')}
        concepts={[concept]}
        onOpenPopup={onOpenPopup}
        onConceptHover={onConceptHover}
        onConceptClick={onConceptClick}
      />
    )

    await screen.findByText('Assistant response')

    const conceptButton = screen.getByRole('button', { name: 'concept-c1' })
    fireEvent.mouseEnter(conceptButton, { clientX: 10, clientY: 20 })
    fireEvent.click(conceptButton, { clientX: 30, clientY: 40 })

    expect(onOpenPopup).toHaveBeenCalledTimes(2)
    expect(onOpenPopup).toHaveBeenCalledWith(concept, { x: 20, y: 30 })
    expect(onOpenPopup).toHaveBeenCalledWith(concept, { x: 40, y: 50 })
    expect(onConceptHover).toHaveBeenCalledWith(concept, question)
    expect(onConceptClick).toHaveBeenCalledWith(concept, question)
    expect(screen.queryByTestId('popup-card')).not.toBeInTheDocument()
  })

  it('auto-extracts concepts, fixes misaligned indices, and drops invalid concepts', async () => {
    const assistantContent = 'Neural networks support reinforcement learning systems.'
    const extractConcepts = vi.fn().mockResolvedValue([
      makeConcept('exact', 'Neural', 0, 6),
      makeConcept('nearest', 'reinforcement', 0, 13),
      makeConcept('normalized', 'evolutionary', 20, 31, 'learning'),
      makeConcept('partial', 'networks modeling', 30, 47),
      makeConcept('drop', 'quantum', 0, 7),
    ])

    render(
      <ChatView
        question={question}
        onBack={vi.fn()}
        onSendMessage={vi.fn().mockResolvedValue(assistantContent)}
        extractConcepts={extractConcepts}
      />
    )

    await screen.findByText(assistantContent)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1100))
    })

    await waitFor(() => {
      expect(extractConcepts).toHaveBeenCalledWith(assistantContent)
    })

    expect(screen.getByText(/Neural@0-6/)).toBeInTheDocument()
    expect(screen.getByText(/reinforcement@24-37/)).toBeInTheDocument()
    expect(screen.getByText(/learning@38-46/)).toBeInTheDocument()
    expect(screen.getByText(/networks support\s*@7-24/)).toBeInTheDocument()
    expect(screen.queryByText(/quantum@/i)).not.toBeInTheDocument()
  })

  it('recovers from extraction failures, supports manual extraction, and wires stash/drag payloads', async () => {
    const assistantContent = 'Alpha Beta Gamma'
    const extractConcepts = vi
      .fn()
      .mockRejectedValueOnce(new Error('extract failed'))
      .mockResolvedValueOnce([makeConcept('beta', 'Beta', 6, 10)])

    const { container } = render(
      <ChatView
        question={question}
        onBack={vi.fn()}
        onSendMessage={vi.fn().mockResolvedValue(assistantContent)}
        extractConcepts={extractConcepts}
      />
    )

    await screen.findByText(assistantContent)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1100))
    })

    await waitFor(() => {
      expect(extractConcepts).toHaveBeenCalledTimes(1)
    })
    expect(screen.queryByText(/Beta@6-10/)).not.toBeInTheDocument()

    const generateButtons = screen.getAllByRole('button', { name: /generate ai highlights/i })
    fireEvent.click(generateButtons[1])

    await waitFor(() => {
      expect(extractConcepts).toHaveBeenCalledTimes(2)
      expect(screen.getByText(/Beta@6-10/)).toBeInTheDocument()
    })

    const stashButtons = screen.getAllByRole('button', { name: 'stash-message' })
    fireEvent.click(stashButtons[1])
    expect(stashHarness.addItem).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'chat-message',
        content: assistantContent,
        metadata: expect.objectContaining({ messageIndex: 1, questionContext: question }),
      })
    )

    const headers = Array.from(container.querySelectorAll('[draggable="true"]'))
    const dataTransfer = { setData: vi.fn(), effectAllowed: '' }
    fireEvent.dragStart(headers[1], { dataTransfer })

    expect(dataTransfer.setData).toHaveBeenCalledWith(
      'application/json',
      expect.stringContaining('"messageIndex":1')
    )
    expect(dataTransfer.effectAllowed).toBe('copy')
  })

  it('creates manual highlights from text selection, suppresses overlap, and allows removal/re-add', async () => {
    const onConceptClick = vi.fn()

    render(
      <ChatView
        question={question}
        onBack={vi.fn()}
        onSendMessage={vi.fn().mockResolvedValue('Assistant response')}
        onConceptClick={onConceptClick}
      />
    )

    await screen.findByText('Assistant response')

    const userMessageText = screen.getByText(initialPrompt)
    const userMessageTextNode = userMessageText.firstChild as Text

    selectText(userMessageTextNode, 8, 15)
    fireEvent.mouseUp(userMessageText)

    await waitFor(() => {
      expect(onConceptClick).toHaveBeenCalledTimes(1)
      expect(onConceptClick).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'explore', startIndex: 8, endIndex: 15 }),
        question
      )
    })

    selectText(userMessageTextNode, 8, 15)
    fireEvent.mouseUp(userMessageText)
    expect(onConceptClick).toHaveBeenCalledTimes(1)

    const markdownBlocks = screen.getAllByTestId('markdown-block')
    const promptBlock = markdownBlocks.find((block) =>
      within(block).queryByText(initialPrompt)
    )
    expect(promptBlock).toBeDefined()

    fireEvent.click(within(promptBlock!).getByRole('button', { name: 'remove-first-concept' }))

    selectText(userMessageTextNode, 8, 15)
    fireEvent.mouseUp(userMessageText)

    await waitFor(() => {
      expect(onConceptClick).toHaveBeenCalledTimes(2)
    })
  })

  it('resolves closest occurrence when concept text appears multiple times', async () => {
    const assistantContent = 'Alpha beta gamma beta delta'
    const extractConcepts = vi.fn().mockResolvedValue([
      makeConcept('beta', 'beta', 0, 4),
    ])

    render(
      <ChatView
        question={question}
        onBack={vi.fn()}
        onSendMessage={vi.fn().mockResolvedValue(assistantContent)}
        extractConcepts={extractConcepts}
      />
    )

    await screen.findByText(assistantContent)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1100))
    })

    await waitFor(() => {
      expect(screen.getByText(/beta@6-10/)).toBeInTheDocument()
    })
  })

  it('supports/guards non-text selection containers while resolving manual highlight offsets', async () => {
    const onConceptClick = vi.fn()
    render(
      <ChatView
        question={question}
        onBack={vi.fn()}
        onSendMessage={vi.fn().mockResolvedValue('Assistant response')}
        onConceptClick={onConceptClick}
      />
    )

    await screen.findByText('Assistant response')

    const promptText = screen.getByText(initialPrompt)

    // Element container with text-node child: should be resolved
    const validRange = document.createRange()
    validRange.setStart(promptText, 0)
    validRange.setEnd(promptText.firstChild as Text, 4)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(validRange)
    fireEvent.mouseUp(promptText)
    await waitFor(() => {
      expect(onConceptClick).toHaveBeenCalledTimes(1)
    })

    // Element container with no text-node at offset: should be ignored
    const block = promptText.closest('[data-testid="markdown-block"]') as HTMLElement
    const range = document.createRange()
    range.setStart(block, 1)
    range.setEnd((promptText.firstChild as Text), 3)
    selection?.removeAllRanges()
    selection?.addRange(range)
    fireEvent.mouseUp(promptText)
    expect(onConceptClick).toHaveBeenCalledTimes(1)
  })
})
