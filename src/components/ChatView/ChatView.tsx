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
import { ConceptPopup, type PopupPosition } from '../ConceptPopup'
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
  /** Current concept explanation being displayed */
  conceptExplanation?: ConceptExplanation | null
  /** Whether concept explanation is loading */
  isConceptLoading?: boolean
  /** Error loading concept explanation */
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
  
  /**
   * State for an open popup.
   */
  interface OpenPopup {
    concept: ExtractedConcept
    position: PopupPosition
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
   */
  const handleConceptHover = useCallback((concept: ExtractedConcept, event: React.MouseEvent) => {
    // Check if this concept already has an open popup
    const existingPopup = openPopups.find(p => p.concept.id === concept.id)
    if (existingPopup) return
    
    // Add new popup
    const newPopup: OpenPopup = {
      concept,
      position: { x: event.clientX + 10, y: event.clientY + 10 },
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
   */
  const handleConceptClick = useCallback((concept: ExtractedConcept, event: React.MouseEvent) => {
    event.stopPropagation()
    
    // Check if this concept already has an open popup
    const existingPopup = openPopups.find(p => p.concept.id === concept.id)
    if (existingPopup) return
    
    // Add new popup
    const newPopup: OpenPopup = {
      concept,
      position: { x: event.clientX + 10, y: event.clientY + 10 },
    }
    setOpenPopups(prev => [...prev, newPopup])
    onConceptClick?.(concept)
  }, [openPopups, onConceptClick])

  /**
   * Handles popup close for a specific concept.
   */
  const handlePopupClose = useCallback((conceptId: string) => {
    setOpenPopups(prev => prev.filter(p => p.concept.id !== conceptId))
    onConceptLeave?.()
  }, [onConceptLeave])

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
      {openPopups.map(popup => (
        <ConceptPopup
          key={popup.concept.id}
          concept={popup.concept}
          explanation={conceptExplanation?.conceptId === popup.concept.id ? conceptExplanation : null}
          isLoading={isConceptLoading}
          error={conceptError}
          position={popup.position}
          onClose={() => handlePopupClose(popup.concept.id)}
        />
      ))}

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
            >
              <div className={styles.messageRole}>
                {msg.role === 'user' ? 'You' : 'AI'}
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
