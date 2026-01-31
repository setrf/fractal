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
 */

import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import type { ChatMessage } from '../../api'
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
}: ChatViewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

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
          <span className={styles.questionText}>{question}</span>
        </div>
      </header>

      {/* Messages area */}
      <div className={styles.messages}>
        {messages.length === 0 ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyTitle}>Explore this question</p>
            <p className={styles.emptyHint}>
              Start a conversation to dive deep into this topic.
              The AI will help you think through different aspects.
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
