import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import styles from './QuestionInput.module.css'

interface QuestionInputProps {
  onSubmit: (question: string) => void
  placeholder?: string
  autoFocus?: boolean
}

export function QuestionInput({
  onSubmit,
  placeholder = 'What are you curious about?',
  autoFocus = true,
}: QuestionInputProps) {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus()
    }
  }, [autoFocus])

  const handleSubmit = () => {
    const trimmed = value.trim()
    if (trimmed) {
      onSubmit(trimmed)
      setValue('')
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.inputWrapper}>
        <span className={styles.prompt}>?</span>
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
        <button
          className={styles.submit}
          onClick={handleSubmit}
          disabled={!value.trim()}
          aria-label="Submit question"
        >
          →
        </button>
      </div>
      <p className={styles.hint}>
        Press Enter to explore
      </p>
    </div>
  )
}
