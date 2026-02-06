/**
 * @fileoverview Chat interface component for a Probe.
 *
 * Displays the selected stash items as context, message history,
 * and input area for sending messages.
 *
 * Features:
 * - Selected stash items display
 * - Message history with user/assistant distinction
 * - Auto-scroll to latest message
 * - Prompt synthesis from stash items
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import styles from './ProbeChat.module.css'
import { useProbeContext } from '../../context/ProbeContext'
import { useStashContext } from '../../context/StashContext'
import { useModelContext } from '../../context/ModelContext'
import { sendProbeChatMessage } from '../../api/client'
import type { Probe } from '../../types/probe'
import type { StashItem } from '../../types/stash'

/**
 * Props for the ProbeChat component.
 */
interface ProbeChatProps {
  /** The probe to display */
  probe: Probe
}

/**
 * Chat interface for a specific Probe.
 *
 * Shows selected stash items and allows conversation with the LLM.
 */
export function ProbeChat({ probe }: ProbeChatProps) {
  const {
    addMessage,
    removeStashItemFromProbe,
    synthesizePrompt,
  } = useProbeContext()

  const { items: stashItems } = useStashContext()
  const { selectedModel } = useModelContext()

  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [inputHeight, setInputHeight] = useState(160)
  const [isResizing, setIsResizing] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputAreaRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize handler
  useEffect(() => {
    if (!textareaRef.current || isResizing) return

    // Reset height to compute scrollHeight correctly
    const textarea = textareaRef.current
    const originalHeight = textarea.style.height
    textarea.style.height = 'auto'
    const scrollHeight = textarea.scrollHeight
    textarea.style.height = originalHeight

    // Add padding for border/padding
    const newHeight = Math.max(160, Math.min(600, scrollHeight + 32))
    setInputHeight(newHeight)
  }, [input, isResizing])

  // Resize handler
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }, [])

  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!inputAreaRef.current) return
      const rect = inputAreaRef.current.getBoundingClientRect()
      // Dragging up increases height. Current mouse Y vs bottom of input area.
      const newHeight = rect.bottom - e.clientY - 24 // 24 for padding
      setInputHeight(Math.max(100, Math.min(600, newHeight)))
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing])

  // Get selected stash items for this probe
  const selectedItems = stashItems.filter(item =>
    probe.selectedStashItemIds.includes(item.id)
  )

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [probe.messages])

  // Handle removing a stash item from selection
  const handleRemoveItem = useCallback((itemId: string) => {
    removeStashItemFromProbe(probe.id, itemId)
  }, [probe.id, removeStashItemFromProbe])

  // Handle synthesizing prompt from selected items
  const handleSynthesize = useCallback(() => {
    const synthesized = synthesizePrompt(probe.id, stashItems)
    setInput(synthesized)
  }, [probe.id, stashItems, synthesizePrompt])

  // Handle sending a message
  const handleSend = useCallback(async () => {
    const trimmedInput = input.trim()
    if (!trimmedInput || sending) return

    // Add user message
    addMessage(probe.id, {
      role: 'user',
      content: trimmedInput,
      sourceStashItemIds: probe.selectedStashItemIds,
    })

    setInput('')
    setSending(true)

    try {
      const isApiMessage = (
        message: Probe['messages'][number]
      ): message is Probe['messages'][number] & { role: 'user' | 'assistant' } =>
        message.role === 'user' || message.role === 'assistant'

      // Build messages array including history
      const messagesForApi = [
        ...probe.messages
          .filter(isApiMessage)
          .map(m => ({ role: m.role, content: m.content })),
        { role: 'user' as const, content: trimmedInput },
      ]

      // Send to API
      const response = await sendProbeChatMessage(messagesForApi, selectedItems, selectedModel || undefined)

      // Add assistant message
      addMessage(probe.id, {
        role: 'assistant',
        content: response,
      })
    } catch (error) {
      console.error('[ProbeChat] Failed to send message:', error)
      addMessage(probe.id, {
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your request. Please try again.',
      })
    } finally {
      setSending(false)
    }
  }, [input, sending, probe, addMessage, selectedItems, selectedModel])

  // Handle key press (Enter to send, Shift+Enter for new line)
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  // Get truncated content for display
  const getTruncatedContent = (item: StashItem): string => {
    const content = item.metadata.title || item.content
    return content.length > 30 ? content.slice(0, 30) + '...' : content
  }

  return (
    <div className={styles.container}>
      {/* Selected stash items context */}
      <div className={styles.contextArea}>
        <div className={styles.contextHeader}>
          <h3 className={styles.contextTitle}>
            Context
            <span className={styles.contextCount}> ({selectedItems.length})</span>
          </h3>
          {selectedItems.length > 0 && (
            <button
              className={styles.synthesizeButton}
              onClick={handleSynthesize}
              title="Generate prompt from selected items"
              data-onboarding="probe-synthesize"
            >
              Synthesize
            </button>
          )}
        </div>

        {selectedItems.length === 0 ? (
          <p className={styles.noItems}>
            Drag items from Stash or use checkboxes to add context
          </p>
        ) : (
          <div className={styles.selectedItems}>
            {selectedItems.map(item => (
              <div key={item.id} className={styles.selectedItem}>
                <span className={styles.selectedItemText}>
                  {getTruncatedContent(item)}
                </span>
                <button
                  className={styles.selectedItemRemove}
                  onClick={() => handleRemoveItem(item.id)}
                  aria-label="Remove from context"
                  title="Remove"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Messages */}
      <div className={styles.messages}>
        {probe.messages.length === 0 ? (
          <div className={styles.emptyMessages}>
            <p className={styles.emptyText}>No messages yet</p>
            <p className={styles.emptyHint}>
              {selectedItems.length > 0
                ? 'Click "Synthesize" to start from your context, or type a message'
                : 'Add items from your Stash and start a conversation'}
            </p>
          </div>
        ) : (
          probe.messages
            .filter(m => m.role !== 'system')
            .map(message => (
              <div
                key={message.id}
                className={`${styles.message} ${styles[message.role]}`}
              >
                <span className={styles.messageRole}>
                  {message.role === 'user' ? 'You' : 'AI'}
                </span>
                <div className={styles.messageContent}>
                  <ReactMarkdown>{message.content}</ReactMarkdown>
                </div>
              </div>
            ))
        )}

        {/* Loading indicator */}
        {sending && (
          <div className={`${styles.message} ${styles.assistant}`}>
            <span className={styles.messageRole}>AI</span>
            <div className={styles.loading}>
              <div className={styles.loadingDots}>
                <div className={styles.loadingDot} />
                <div className={styles.loadingDot} />
                <div className={styles.loadingDot} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div 
        className={styles.inputArea} 
        ref={inputAreaRef}
        style={{ height: inputHeight }}
      >
        <div 
          className={`${styles.inputResizeHandle} ${isResizing ? styles.isResizing : ''}`}
          onMouseDown={handleResizeStart}
        />
        <div className={styles.inputWrapper}>
          <textarea
            ref={textareaRef}
            className={styles.input}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
            disabled={sending}
            data-onboarding="probe-input"
          />
          <button
            className={styles.sendButton}
            onClick={handleSend}
            disabled={!input.trim() || sending}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
