/**
 * @fileoverview ChatGPT-like chat interface for exploring a specific question.
 * 
 * When a user "locks in" on a question, they enter this chat view to have
 * a conversation about that topic. The original question provides context
 * for the entire conversation.
 * 
 * Design:
 * - Neobrutalist styling consistent with the rest of the app
 * - Message bubbles with clear user/assistant distinction
 * - Fixed input at bottom
 * - Auto-scroll to latest message
 * - Concept highlighting in question header with popups
 */

import { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react'
import type { ChatMessage, ExtractedConcept, ConceptExplanation } from '../../api'
import { ConceptHighlighter } from '../ConceptHighlighter'
import { ConceptPopup, type PopupPosition, findNonOverlappingPosition, DEFAULT_POPUP_WIDTH, DEFAULT_POPUP_HEIGHT } from '../ConceptPopup'
import { StashButton } from '../StashButton'
import { useStashContext } from '../../context/StashContext'
import styles from './ChatView.module.css'

/**
 * Props for the ChatView component.
 */
interface ChatViewProps {
  /** The question being explored (displayed as header context) */
  question: string
  /** Callback to go back to the tree view */
  onBack: () => void
  /** Function to send a message and get a response */
  onSendMessage: (messages: ChatMessage[]) => Promise<string>
  /** Whether a message is currently being sent */
  isLoading?: boolean
  
  // Concept highlighting props
  /** Extracted concepts to highlight in the question text */
  concepts?: ExtractedConcept[]
  /** Map of concept IDs to their explanations (for multiple popups) */
  conceptExplanations?: Record<string, ConceptExplanation>
  /** Map of concept IDs to their loading states (for multiple popups) */
  conceptLoadingStates?: Record<string, { isLoading: boolean; error: string | null }>
  /** Legacy: Current concept explanation being displayed */
  conceptExplanation?: ConceptExplanation | null
  /** Legacy: Whether concept explanation is loading */
  isConceptLoading?: boolean
  /** Legacy: Error loading concept explanation */
  conceptError?: string | null
  /** Callback when a concept is hovered */
  onConceptHover?: (concept: ExtractedConcept) => void
  /** Callback when concept hover ends */
  onConceptLeave?: () => void
  /** Callback when a concept is clicked */
  onConceptClick?: (concept: ExtractedConcept) => void
}

/**
 * Chat interface for deep exploration of a specific question.
 * 
 * Features:
 * - Message history display
 * - Text input with Enter to send
 * - Loading state during AI response
 * - Auto-scroll to new messages
 * - Back button to return to tree
 * 
 * @example
 * ```tsx
 * <ChatView
 *   question="What is consciousness?"
 *   onBack={() => setView('tree')}
 *   onSendMessage={async (msgs) => await sendChatMessage(question, msgs)}
 * />
 * ```
 */
export function ChatView({
  question,
  onBack,
  onSendMessage,
  isLoading = false,
  // Concept props
  concepts = [],
  conceptExplanations = {},
  conceptLoadingStates = {},
  conceptExplanation,
  isConceptLoading = false,
  conceptError,
  onConceptHover,
  onConceptLeave,
  onConceptClick,
}: ChatViewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [initialQuerySent, setInitialQuerySent] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  
  // Stash context for adding messages to stash
  const { addItem, hasItem } = useStashContext()
  
  /**
   * Stashes a chat message to the Stash.
   */
  const handleStashMessage = useCallback((message: ChatMessage, index: number) => {
    addItem({
      type: 'chat-message',
      content: message.content,
      metadata: {
        role: message.role,
        questionContext: question,
        messageIndex: index,
      },
    })
  }, [addItem, question])

  /**
   * Handles drag start for dragging message to stash.
   */
  const handleMessageDragStart = useCallback((e: React.DragEvent, message: ChatMessage, index: number) => {
    const itemData = {
      type: 'chat-message',
      content: message.content,
      metadata: {
        role: message.role,
        questionContext: question,
        messageIndex: index,
      },
    }
    e.dataTransfer.setData('application/json', JSON.stringify(itemData))
    e.dataTransfer.effectAllowed = 'copy'
  }, [question])
  
  /**
   * State for an open popup.
   */
  interface OpenPopup {
    concept: ExtractedConcept
    position: PopupPosition
    isMinimized: boolean
  }
  
  // State for concept popups (supports multiple open popups)
  const [openPopups, setOpenPopups] = useState<OpenPopup[]>([])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Automatically query for an answer when entering the chat view
  useEffect(() => {
    if (initialQuerySent) return
    
    const sendInitialQuery = async () => {
      setInitialQuerySent(true)
      setSending(true)
      
      // The initial "message" is just asking about the question itself
      const initialMessage: ChatMessage = { 
        role: 'user', 
        content: 'Help me explore and understand this question.' 
      }
      
      try {
        const response = await onSendMessage([initialMessage])
        
        // Add both the implicit query and the response
        setMessages([
          initialMessage,
          { role: 'assistant', content: response }
        ])
      } catch (error) {
        setMessages([
          initialMessage,
          { 
            role: 'assistant', 
            content: `Error: ${error instanceof Error ? error.message : 'Failed to get response'}` 
          }
        ])
      } finally {
        setSending(false)
        inputRef.current?.focus()
      }
    }

    sendInitialQuery()
  }, [initialQuerySent, onSendMessage])

  /**
   * Handle sending a message.
   */
  const handleSend = async () => {
    const trimmed = input.trim()
    if (!trimmed || sending) return

    // Add user message
    const userMessage: ChatMessage = { role: 'user', content: trimmed }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setSending(true)

    try {
      // Get AI response
      const response = await onSendMessage(newMessages)
      
      // Add assistant message
      const assistantMessage: ChatMessage = { role: 'assistant', content: response }
      setMessages([...newMessages, assistantMessage])
    } catch (error) {
      // Add error message
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Failed to get response'}`,
      }
      setMessages([...newMessages, errorMessage])
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  /**
   * Handle keyboard events in the input.
   */
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  /**
   * Handles concept hover - opens a new popup.
   * Multiple popups can be open at the same time.
   * Prevents duplicates by checking normalizedName (same concept = same popup).
   * Positions new popups to avoid overlapping with existing ones.
   */
  const handleConceptHover = useCallback((concept: ExtractedConcept, event: React.MouseEvent) => {
    // Check if this concept already has an open popup (by normalizedName to prevent duplicates)
    const existingPopup = openPopups.find(p => 
      p.concept.id === concept.id || p.concept.normalizedName === concept.normalizedName
    )
    if (existingPopup) return
    
    // Find non-overlapping position for new popup
    const existingPositions = openPopups.map(p => ({
      x: p.position.x,
      y: p.position.y,
      width: DEFAULT_POPUP_WIDTH,
      height: DEFAULT_POPUP_HEIGHT,
      isMinimized: p.isMinimized,
    }))
    const position = findNonOverlappingPosition(
      event.clientX + 10,
      event.clientY + 10,
      existingPositions
    )
    
    // Add new popup
    const newPopup: OpenPopup = {
      concept,
      position,
      isMinimized: false,
    }
    setOpenPopups(prev => [...prev, newPopup])
    onConceptHover?.(concept)
  }, [openPopups, onConceptHover])

  /**
   * Handles concept hover end - no-op since popups are persistent.
   * Popup only closes when user explicitly clicks close button.
   */
  const handleConceptLeave = useCallback(() => {
    // Don't close popup on mouse leave - user must click close button
    // This provides a better UX for reading explanations
  }, [])

  /**
   * Handles concept click - opens popup if not already open.
   * Prevents duplicates by checking normalizedName (same concept = same popup).
   * Positions new popups to avoid overlapping with existing ones.
   */
  const handleConceptClick = useCallback((concept: ExtractedConcept, event: React.MouseEvent) => {
    event.stopPropagation()
    
    // Check if this concept already has an open popup (by normalizedName to prevent duplicates)
    const existingPopup = openPopups.find(p => 
      p.concept.id === concept.id || p.concept.normalizedName === concept.normalizedName
    )
    if (existingPopup) return
    
    // Find non-overlapping position for new popup
    const existingPositions = openPopups.map(p => ({
      x: p.position.x,
      y: p.position.y,
      width: DEFAULT_POPUP_WIDTH,
      height: DEFAULT_POPUP_HEIGHT,
      isMinimized: p.isMinimized,
    }))
    const position = findNonOverlappingPosition(
      event.clientX + 10,
      event.clientY + 10,
      existingPositions
    )
    
    // Add new popup
    const newPopup: OpenPopup = {
      concept,
      position,
      isMinimized: false,
    }
    setOpenPopups(prev => [...prev, newPopup])
    onConceptClick?.(concept)
  }, [openPopups, onConceptClick])

  /**
   * Handles popup close for a specific concept.
   * Note: We don't call onConceptLeave here because that would reset ALL explanations.
   * Each popup manages its own lifecycle independently.
   */
  const handlePopupClose = useCallback((conceptId: string) => {
    setOpenPopups(prev => prev.filter(p => p.concept.id !== conceptId))
  }, [])

  /**
   * Handles clicking a related concept in a popup.
   * Creates a new popup for the related concept.
   */
  const handleRelatedConceptClick = useCallback((conceptName: string) => {
    // Check if this concept already has an open popup
    const existingPopup = openPopups.find(p => 
      p.concept.normalizedName === conceptName.toLowerCase()
    )
    if (existingPopup) return
    
    // Create a synthetic concept for the related item
    const syntheticConcept: ExtractedConcept = {
      id: `related_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      text: conceptName,
      normalizedName: conceptName.toLowerCase(),
      category: 'abstract',  // Default category for related concepts
      startIndex: -1,  // Not in the original text
      endIndex: -1,
    }
    
    // Find non-overlapping position
    const existingPositions = openPopups.map(p => ({
      x: p.position.x,
      y: p.position.y,
      width: DEFAULT_POPUP_WIDTH,
      height: DEFAULT_POPUP_HEIGHT,
      isMinimized: p.isMinimized,
    }))
    
    // Position near center of viewport for related concepts
    const position = findNonOverlappingPosition(
      window.innerWidth / 2 - DEFAULT_POPUP_WIDTH / 2,
      window.innerHeight / 3,
      existingPositions
    )
    
    // Add new popup
    const newPopup: OpenPopup = {
      concept: syntheticConcept,
      position,
      isMinimized: false,
    }
    setOpenPopups(prev => [...prev, newPopup])
    
    // Trigger explanation fetch if callback exists
    onConceptClick?.(syntheticConcept)
  }, [openPopups, onConceptClick])

  /**
   * Handles popup minimize state change.
   * Updates the popup's isMinimized state for stack index calculation.
   */
  const handlePopupMinimizeChange = useCallback((conceptId: string, isMinimized: boolean) => {
    setOpenPopups(prev => prev.map(p => 
      p.concept.id === conceptId ? { ...p, isMinimized } : p
    ))
  }, [])

  const isDisabled = sending || isLoading

  return (
    <div className={styles.container}>
      {/* Header with question context and back button */}
      <header className={styles.header}>
        <button
          className={styles.backBtn}
          onClick={onBack}
          aria-label="Back to question tree"
        >
          ←
        </button>
        <div className={styles.questionContext}>
          <span className={styles.prefix}>?</span>
          {concepts.length > 0 ? (
            <ConceptHighlighter
              text={question}
              concepts={concepts}
              className={styles.questionText}
              onConceptHover={handleConceptHover}
              onConceptLeave={handleConceptLeave}
              onConceptClick={handleConceptClick}
            />
          ) : (
            <span className={styles.questionText}>{question}</span>
          )}
        </div>
      </header>

      {/* Concept explanation popups - multiple can be open */}
      {openPopups.map((popup, _index) => {
        // Get explanation for this specific popup from the maps, or fall back to legacy props
        const explanation = conceptExplanations[popup.concept.id] 
          || (conceptExplanation?.conceptId === popup.concept.id ? conceptExplanation : null)
        const loadingState = conceptLoadingStates[popup.concept.id]
        const popupIsLoading = loadingState?.isLoading ?? (conceptExplanation?.conceptId === popup.concept.id ? isConceptLoading : false)
        const popupError = loadingState?.error ?? (conceptExplanation?.conceptId === popup.concept.id ? conceptError : null)
        
        // Calculate stack index for minimized popups (count how many minimized popups are before this one)
        const minimizedStackIndex = openPopups
          .filter((p, i) => p.isMinimized && i < openPopups.indexOf(popup))
          .length
        
        return (
          <ConceptPopup
            key={popup.concept.id}
            concept={popup.concept}
            explanation={explanation}
            isLoading={popupIsLoading}
            error={popupError}
            position={popup.position}
            onClose={() => handlePopupClose(popup.concept.id)}
            onRelatedConceptClick={handleRelatedConceptClick}
            onMinimizeChange={handlePopupMinimizeChange}
            minimizedStackIndex={minimizedStackIndex}
          />
        )
      })}

      {/* Messages area */}
      <div className={styles.messages}>
        {messages.length === 0 && !sending ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyTitle}>Explore this question</p>
            <p className={styles.emptyHint}>
              Start a conversation to dive deep into this topic.
              The AI will help you think through different aspects.
            </p>
          </div>
        ) : messages.length === 0 && sending ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyTitle}>
              <span className={styles.thinking}>◌ Exploring...</span>
            </p>
            <p className={styles.emptyHint}>
              Getting an initial exploration of this question...
            </p>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div
              key={index}
              className={`${styles.message} ${styles[msg.role]}`}
              draggable
              onDragStart={(e) => handleMessageDragStart(e, msg, index)}
            >
              <div className={styles.messageHeader}>
                <div className={styles.messageRole}>
                  {msg.role === 'user' ? 'You' : 'AI'}
                </div>
                <StashButton
                  onClick={() => handleStashMessage(msg, index)}
                  isStashed={hasItem(msg.content, 'chat-message')}
                  size="small"
                  className={styles.messageStashBtn}
                />
              </div>
              <div className={styles.messageContent}>
                {msg.content}
              </div>
            </div>
          ))
        )}
        
        {/* Loading indicator */}
        {sending && (
          <div className={`${styles.message} ${styles.assistant}`}>
            <div className={styles.messageRole}>AI</div>
            <div className={styles.messageContent}>
              <span className={styles.thinking}>◌ Thinking...</span>
            </div>
          </div>
        )}
        
        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className={styles.inputArea}>
        <textarea
          ref={inputRef}
          className={styles.input}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
          disabled={isDisabled}
          rows={1}
        />
        <button
          className={styles.sendBtn}
          onClick={handleSend}
          disabled={isDisabled || !input.trim()}
          aria-label="Send message"
        >
          →
        </button>
      </div>
    </div>
  )
}
