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

import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import styles from './QuestionInput.module.css'

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
  
  // Ref for programmatic focus
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-focus on mount if enabled
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus()
    }
  }, [autoFocus])

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
   * Enter key triggers submission (without Shift for potential future multi-line).
   */
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className={styles.container}>
      {/* Input wrapper provides the bordered container with focus shadow */}
      <div className={styles.inputWrapper}>
        {/* Static question mark prompt */}
        <span className={styles.prompt}>?</span>
        
        {/* Main text input */}
        <input
          ref={inputRef}
          type="text"
          className={styles.input}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-label="Enter your question"
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
