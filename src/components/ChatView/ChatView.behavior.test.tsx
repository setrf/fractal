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
      <button aria-label="remove-missing-concept" onClick={() => onConceptRemove?.('missing-concept')}>
        remove missing concept
      </button>
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
      makeConcept('c3', 'systems', 36, 43),
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
    fireEvent.mouseLeave(firstConcept)
    expect(onConceptHover).toHaveBeenCalledWith(concepts[0], question)
    expect(screen.getAllByTestId('popup-card')).toHaveLength(1)

    fireEvent.mouseEnter(firstConcept, { clientX: 40, clientY: 50 })
    expect(screen.getAllByTestId('popup-card')).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: 'concept-c2' }), { clientX: 80, clientY: 90 })
    expect(onConceptClick).toHaveBeenCalledWith(concepts[1], question)
    expect(screen.getAllByTestId('popup-card')).toHaveLength(2)

    fireEvent.mouseEnter(screen.getByRole('button', { name: 'concept-c3' }), { clientX: 90, clientY: 100 })
    expect(screen.getAllByTestId('popup-card')).toHaveLength(3)

    fireEvent.click(screen.getByRole('button', { name: 'concept-c2' }), { clientX: 81, clientY: 91 })
    expect(screen.getAllByTestId('popup-card')).toHaveLength(3)

    fireEvent.click(screen.getByRole('button', { name: 'minimize-popup-c1' }))
    expect(screen.getByText('Stack:c2:1')).toBeInTheDocument()
    expect(screen.getByText('Stack:c3:1')).toBeInTheDocument()

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

    const popupCountAfterFirstRelated = screen.getAllByTestId('popup-card').length
    fireEvent.click(screen.getByRole('button', { name: 'related-popup-c1' }))
    expect(screen.getAllByTestId('popup-card')).toHaveLength(popupCountAfterFirstRelated)

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

  it('sorts multiple manual highlights by start index when added out of order', async () => {
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
    const promptTextNode = promptText.firstChild as Text

    // Add later phrase first.
    selectText(promptTextNode, 20, 30)
    fireEvent.mouseUp(promptText)

    await waitFor(() => {
      expect(onConceptClick).toHaveBeenCalledTimes(1)
    })

    // Add earlier phrase second; reducer should sort both highlights.
    selectText(promptTextNode, 8, 15)
    fireEvent.mouseUp(promptText)

    await waitFor(() => {
      expect(onConceptClick).toHaveBeenCalledTimes(2)
      const promptBlock = screen
        .getAllByTestId('markdown-block')
        .find((block) => within(block).queryByText(initialPrompt))
      expect(promptBlock).toBeDefined()
      expect(within(promptBlock as HTMLElement).getByText(/explore@8-15\|understand@20-30/)).toBeInTheDocument()
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

  it('guards send/selection edge cases and ignores selections missing from message content', async () => {
    const followUpDeferred = (() => {
      let resolve!: (value: string) => void
      const promise = new Promise<string>((res) => {
        resolve = res
      })
      return { promise, resolve }
    })()

    const onSendMessage = vi
      .fn()
      .mockResolvedValueOnce('Assistant response')
      .mockImplementationOnce(() => followUpDeferred.promise)

    render(
      <ChatView
        question={question}
        onBack={vi.fn()}
        onSendMessage={onSendMessage}
      />
    )

    await screen.findByText('Assistant response')

    const input = screen.getByPlaceholderText(
      /type your message... \(enter to send, shift\+enter for new line\)/i
    ) as HTMLTextAreaElement
    const sendButton = screen.getByRole('button', { name: /send message/i })

    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSendMessage).toHaveBeenCalledTimes(1)

    fireEvent.change(input, { target: { value: 'second request' } })
    fireEvent.click(sendButton)
    fireEvent.click(sendButton)
    expect(onSendMessage).toHaveBeenCalledTimes(2)

    await act(async () => {
      followUpDeferred.resolve('Second response')
      await Promise.resolve()
    })

    const promptText = screen.getByText(initialPrompt)
    const promptTextNode = promptText.firstChild as Text

    selectText(promptTextNode, 0, 1)
    fireEvent.mouseUp(promptText)

    const outsideText = document.createTextNode('outside selection')
    document.body.appendChild(outsideText)
    const outsideRange = document.createRange()
    outsideRange.setStart(outsideText, 0)
    outsideRange.setEnd(outsideText, 7)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(outsideRange)
    fireEvent.mouseUp(promptText)

    const markdownBlocks = screen.getAllByTestId('markdown-block')
    const noConcepts = within(markdownBlocks[0]).getByText('no-concepts')
    const noConceptsNode = noConcepts.firstChild as Text
    selectText(noConceptsNode, 0, noConceptsNode.length)
    fireEvent.mouseUp(promptText)

    const block = markdownBlocks[0]
    const nonTextRange = document.createRange()
    nonTextRange.setStart(block, 1)
    nonTextRange.setEnd(promptTextNode, 3)
    selection?.removeAllRanges()
    selection?.addRange(nonTextRange)
    fireEvent.mouseUp(promptText)
  })

  it('shows fallback error text for non-Error failures in initial and follow-up sends', async () => {
    const onSendMessage = vi
      .fn()
      .mockRejectedValueOnce('initial failed')
      .mockRejectedValueOnce({ reason: 'follow-up failed' })

    render(
      <ChatView
        question={question}
        onBack={vi.fn()}
        onSendMessage={onSendMessage}
      />
    )

    await screen.findByText('Error: Failed to get response')

    const input = screen.getByPlaceholderText(
      /type your message... \(enter to send, shift\+enter for new line\)/i
    )
    fireEvent.change(input, { target: { value: 'follow up question' } })
    fireEvent.click(screen.getByRole('button', { name: /send message/i }))

    await waitFor(() => {
      expect(screen.getAllByText('Error: Failed to get response').length).toBeGreaterThanOrEqual(2)
    })
    expect(onSendMessage).toHaveBeenCalledTimes(2)
  })

  it('covers validation fallback branches for invalid indices and partial-match rejection', async () => {
    const assistantContent = 'beta beta alpha zzz'
    const extractConcepts = vi.fn().mockResolvedValue([
      makeConcept('closest-late', 'beta', 999, 1003),
      makeConcept('normalized-miss', 'ghost', 10, 15, 'phantom'),
      makeConcept('short-first-word', 'AI model', 2, 10),
      makeConcept('partial-none', 'quantum field', 3, 16),
      makeConcept('partial-fail-threshold', 'alpha beta gamma', 8, 24),
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
      expect(screen.getByText(/beta@5-9/)).toBeInTheDocument()
    })

    expect(screen.queryByText(/ghost@/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/AI model@/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/quantum field@/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/alpha beta gamma@/i)).not.toBeInTheDocument()
  })

  it('uses 500ms extraction delay for later assistant messages and supports legacy popup fallback props', async () => {
    const headerConcept = makeConcept('legacy-c1', 'ideas', 7, 12)
    const followupResponse = 'repeat repeat repeat'
    const extractConcepts = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makeConcept('repeat', 'repeat', 0, 6)])

    render(
      <ChatView
        question={question}
        onBack={vi.fn()}
        onSendMessage={vi.fn().mockResolvedValueOnce('Assistant response').mockResolvedValueOnce(followupResponse)}
        extractConcepts={extractConcepts}
        concepts={[headerConcept]}
        conceptExplanation={{
          conceptId: headerConcept.id,
          normalizedName: headerConcept.normalizedName,
          definition: 'legacy explanation',
          category: 'abstract',
          confidence: 0.5,
          relatedConcepts: [],
        }}
        isConceptLoading
        conceptError="legacy error"
      />
    )

    await screen.findByText('Assistant response')
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1100))
    })
    await waitFor(() => {
      expect(extractConcepts).toHaveBeenCalledTimes(1)
    })

    fireEvent.mouseEnter(screen.getByRole('button', { name: `concept-${headerConcept.id}` }), { clientX: 11, clientY: 22 })
    expect(screen.getByText('Loading:true')).toBeInTheDocument()
    expect(screen.getByText('Error:legacy error')).toBeInTheDocument()

    const input = screen.getByPlaceholderText(
      /type your message... \(enter to send, shift\+enter for new line\)/i
    )
    fireEvent.change(input, { target: { value: 'another prompt' } })
    fireEvent.click(screen.getByRole('button', { name: /send message/i }))
    await screen.findByText(followupResponse)

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 450))
    })
    expect(extractConcepts).toHaveBeenCalledTimes(1)

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 120))
    })
    await waitFor(() => {
      expect(extractConcepts).toHaveBeenCalledTimes(2)
    })
  })

  it('guards manual selection for non-text/button ranges and exercises overlap variants', async () => {
    const assistantContent = 'Alpha Beta Gamma Delta'
    const extractConcepts = vi.fn().mockResolvedValueOnce([makeConcept('beta', 'Beta', 6, 10)])
    const onConceptClick = vi.fn()

    render(
      <ChatView
        question={question}
        onBack={vi.fn()}
        onSendMessage={vi.fn().mockResolvedValue(assistantContent)}
        extractConcepts={extractConcepts}
        onConceptClick={onConceptClick}
      />
    )

    await screen.findByText(assistantContent)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1100))
    })
    await waitFor(() => {
      expect(screen.getByText(/Beta@6-10/)).toBeInTheDocument()
    })

    const blocks = screen.getAllByTestId('markdown-block')
    const assistantBlock = blocks.find((block) => within(block).queryByText(assistantContent))
    expect(assistantBlock).toBeDefined()
    const assistantTextNode = within(assistantBlock!).getByText(assistantContent).firstChild as Text

    const selection = window.getSelection()
    const contentContainer = assistantBlock!.closest('[class*="messageContent"]') as HTMLElement
    expect(contentContainer).toBeTruthy()

    // Start container is element whose child at offset is non-text -> getTextOffset returns null.
    const nonTextRange = document.createRange()
    nonTextRange.setStart(contentContainer, 0)
    nonTextRange.setEnd(assistantTextNode, 5)
    selection?.removeAllRanges()
    selection?.addRange(nonTextRange)
    fireEvent.mouseUp(contentContainer)

    // Select inside button text (tree walker should reject button text nodes).
    const hoverBtnText = within(assistantBlock!).getByRole('button', { name: /^hover-markdown-beta$/i }).firstChild as Text
    const buttonRange = document.createRange()
    buttonRange.setStart(hoverBtnText, 0)
    buttonRange.setEnd(hoverBtnText, hoverBtnText.length)
    selection?.removeAllRanges()
    selection?.addRange(buttonRange)
    fireEvent.mouseUp(contentContainer)

    // Overlap variant where end lands inside existing concept.
    selectText(assistantTextNode, 0, 8) // "Alpha Be"
    fireEvent.mouseUp(contentContainer)

    // Overlap variant where new range fully covers existing concept.
    selectText(assistantTextNode, 0, 12) // "Alpha Beta G"
    fireEvent.mouseUp(contentContainer)

    // Exercise remove path when no concepts exist for message index.
    fireEvent.click(within(screen.getAllByTestId('markdown-block')[0]).getByRole('button', { name: 'remove-missing-concept' }))

    // All manual attempts above are guarded; no concept callback should fire.
    expect(onConceptClick).not.toHaveBeenCalled()
  })

  it('covers repeated-occurrence distance fallback and empty-text-node offset branches in manual highlights', async () => {
    const onConceptClick = vi.fn()
    render(
      <ChatView
        question={question}
        onBack={vi.fn()}
        onSendMessage={vi.fn().mockResolvedValue('repeat repeat repeat')}
        onConceptClick={onConceptClick}
      />
    )

    await screen.findByText('repeat repeat repeat')

    const blocks = screen.getAllByTestId('markdown-block')
    const assistantBlock = blocks.find((block) => within(block).queryByText('repeat repeat repeat'))
    expect(assistantBlock).toBeDefined()

    const contentContainer = assistantBlock!.closest('[class*="messageContent"]') as HTMLElement
    const assistantTextNode = within(assistantBlock!).getByText('repeat repeat repeat').firstChild as Text
    const selection = window.getSelection()
    expect(contentContainer).toBeTruthy()

    // Start on an empty text node to force the textContent-length fallback arms.
    const emptyNode = document.createTextNode('')
    contentContainer.insertBefore(emptyNode, contentContainer.firstChild)
    const emptyStartRange = document.createRange()
    emptyStartRange.setStart(emptyNode, 0)
    emptyStartRange.setEnd(assistantTextNode, 6)
    selection?.removeAllRanges()
    selection?.addRange(emptyStartRange)
    fireEvent.mouseUp(contentContainer)
    await waitFor(() => {
      expect(onConceptClick).toHaveBeenCalledTimes(1)
    })

    // Remove the just-added concept and re-add from the first occurrence.
    fireEvent.click(within(assistantBlock!).getByRole('button', { name: 'remove-first-concept' }))
    onConceptClick.mockClear()

    // "repeat" appears multiple times; later occurrences exercise non-improving distance branch.
    selectText(assistantTextNode, 0, 6)
    fireEvent.mouseUp(contentContainer)
    await waitFor(() => {
      expect(onConceptClick).toHaveBeenCalledTimes(1)
      expect(onConceptClick).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'repeat', startIndex: 0, endIndex: 6 }),
        question
      )
    })
  })

  it('guards manual selection when adjusted indices collapse to an empty range', async () => {
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

    const block = screen.getAllByTestId('markdown-block')[0]
    const contentContainer = block.closest('[class*="messageContent"]') as HTMLElement
    const textNode = within(block).getByText(initialPrompt).firstChild as Text

    const realGetSelection = window.getSelection
    const syntheticRange = document.createRange()
    syntheticRange.setStart(textNode, 4)
    syntheticRange.setEnd(textNode, 4)
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
    fireEvent.mouseUp(contentContainer)
    Object.defineProperty(window, 'getSelection', {
      configurable: true,
      value: realGetSelection,
    })

    expect(onConceptClick).not.toHaveBeenCalled()
  })

  it('ignores highlight generation requests while a message extraction is already in progress', async () => {
    const extractionDeferred = (() => {
      let resolve!: (value: ExtractedConcept[]) => void
      const promise = new Promise<ExtractedConcept[]>((res) => {
        resolve = res
      })
      return { promise, resolve }
    })()

    const extractConcepts = vi
      .fn()
      .mockReturnValueOnce(extractionDeferred.promise)
      .mockResolvedValue([makeConcept('never-used', 'repeat', 0, 6)])

    render(
      <ChatView
        question={question}
        onBack={vi.fn()}
        onSendMessage={vi.fn().mockResolvedValue('repeat repeat repeat')}
        extractConcepts={extractConcepts}
      />
    )

    await screen.findByText('repeat repeat repeat')

    const generateButtons = screen.getAllByRole('button', { name: /generate ai highlights/i })
    const assistantGenerate = generateButtons[1] as HTMLButtonElement
    fireEvent.click(assistantGenerate)

    await waitFor(() => {
      expect(extractConcepts).toHaveBeenCalledTimes(1)
      expect(assistantGenerate).toBeDisabled()
    })

    // Force-click to execute handler while extracting flag is still set.
    assistantGenerate.disabled = false
    fireEvent.click(assistantGenerate)
    expect(extractConcepts).toHaveBeenCalledTimes(1)

    await act(async () => {
      extractionDeferred.resolve([])
      await Promise.resolve()
    })
  })
})
