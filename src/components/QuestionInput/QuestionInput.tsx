/**
 * @fileoverview Central question input component for Fractal.
 * 
 * This is the primary entry point for user interaction. It displays a
 * terminal-style input with a question mark prompt, allowing users to
 * enter their initial question to begin exploration.
 * 
 * Design:
 * - Monospace font for terminal aesthetic
 * - Bold "?" prompt character
 * - Submit button with arrow icon
 * - Neobrutalist shadow on focus
 * - Hint text showing keyboard shortcut
 */

import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from 'react'
import styles from './QuestionInput.module.css'

// Constants for dynamic sizing
const MIN_WIDTH = 280
const MAX_WIDTH = 800
const PADDING_HORIZONTAL = 80 // Approximate padding + prompt + button width

/**
 * Props for the QuestionInput component.
 */
interface QuestionInputProps {
  /** Callback fired when user submits a question */
  onSubmit: (question: string) => void
  /** Placeholder text shown when input is empty */
  placeholder?: string
  /** Whether to auto-focus the input on mount */
  autoFocus?: boolean
}

/**
 * Terminal-style input for entering questions.
 * 
 * Features:
 * - Question mark prompt prefix
 * - Submit on Enter key
 * - Submit button for mouse users
 * - Auto-focus on mount (configurable)
 * - Disabled submit when empty
 * - Dynamic sizing: expands width first, then height
 * 
 * @example
 * ```tsx
 * <QuestionInput
 *   onSubmit={(q) => console.log('Asked:', q)}
 *   placeholder="What are you curious about?"
 * />
 * ```
 */
export function QuestionInput({
  onSubmit,
  placeholder = 'What are you curious about?',
  autoFocus = true,
}: QuestionInputProps) {
  // Local state for the input value
  const [value, setValue] = useState('')
  
  // Refs for programmatic focus and auto-resize
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const sizerRef = useRef<HTMLSpanElement>(null)

  // Auto-focus on mount if enabled
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [autoFocus])

  /**
   * Auto-resize the input based on content.
   * First expands width up to max-width, then expands height.
   */
  const autoResize = useCallback(() => {
    const textarea = textareaRef.current as HTMLTextAreaElement
    const wrapper = wrapperRef.current as HTMLDivElement
    const sizer = sizerRef.current as HTMLSpanElement

    // Measure text width using the hidden sizer element
    const textToMeasure = value || placeholder
    sizer.textContent = textToMeasure
    const textWidth = sizer.offsetWidth

    // Calculate desired wrapper width (text + padding for prompt, button, gaps)
    const padding = window.innerWidth <= 768 ? 60 : PADDING_HORIZONTAL
    const maxWidth = Math.min(MAX_WIDTH, window.innerWidth * 0.95)
    const minWidth = Math.min(MIN_WIDTH, window.innerWidth * 0.9)
    const desiredWidth = Math.min(maxWidth, Math.max(minWidth, textWidth + padding))
    
    // Apply width to wrapper
    wrapper.style.width = `${desiredWidth}px`

    // Now handle height - reset and measure
    textarea.style.height = 'auto'
    const newHeight = Math.max(textarea.scrollHeight, 27) // Min height ~1 line
    textarea.style.height = `${newHeight}px`
  }, [value, placeholder])

  // Auto-resize when value changes
  useEffect(() => {
    autoResize()
  }, [value, autoResize])

  /**
   * Handles form submission.
   * Trims whitespace and only submits non-empty questions.
   */
  const handleSubmit = () => {
    const trimmed = value.trim()
    if (trimmed) {
      onSubmit(trimmed)
      setValue('') // Clear input after submission
    }
  }

  /**
   * Handles keyboard events.
   * Enter key triggers submission (without Shift for multi-line input).
   */
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className={styles.container}>
      {/* Hidden sizer element to measure text width */}
      <span ref={sizerRef} className={styles.sizer} aria-hidden="true" />
      
      {/* Input wrapper provides the bordered container with focus shadow */}
      <div
        ref={wrapperRef}
        className={styles.inputWrapper}
        data-onboarding="question-input"
      >
        {/* Static question mark prompt */}
        <span className={styles.prompt}>?</span>
        
        {/* Main text input - textarea for multi-line support */}
        <textarea
          ref={textareaRef}
          className={styles.input}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-label="Enter your question"
          rows={1}
        />
        
        {/* Submit button */}
        <button
          className={styles.submit}
          onClick={handleSubmit}
          disabled={!value.trim()}
          aria-label="Submit question"
        >
          →
        </button>
      </div>
      
      {/* Hint text below input */}
      <p className={styles.hint}>
        Press Enter to explore
      </p>
    </div>
  )
}
