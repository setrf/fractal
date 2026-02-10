/**
 * @fileoverview Reusable button component for adding items to the Stash.
 *
 * A small, versatile button with a bookmark/stash icon that can be placed
 * next to any stashable content (highlights, questions, chat messages, etc.).
 *
 * Features:
 * - Visual feedback on hover and click
 * - Tooltip showing "Add to Stash" or "Already stashed"
 * - Size variants for different contexts
 * - Accessible with proper ARIA labels
 */

import { useState, useCallback, type MouseEvent } from 'react'
import styles from './StashButton.module.css'

/**
 * Props for the StashButton component.
 */
export interface StashButtonProps {
  /** Callback when the button is clicked */
  onClick: (e: MouseEvent<HTMLButtonElement>) => void

  /** Whether the item is already stashed */
  isStashed?: boolean

  /** Size variant */
  size?: 'small' | 'medium' | 'large'

  /** Optional custom tooltip text */
  tooltip?: string

  /** Additional CSS class */
  className?: string

  /** Whether the button is disabled */
  disabled?: boolean

  /** Accessible label for screen readers */
  ariaLabel?: string
}

/**
 * Reusable button for adding items to the Stash.
 *
 * Displays a bookmark icon with hover states and optional "already stashed" indicator.
 * Use throughout the app wherever content can be stashed.
 *
 * @example
 * ```tsx
 * <StashButton
 *   onClick={() => addItem({ type: 'highlight', content, metadata: {} })}
 *   isStashed={hasItem(content, 'highlight')}
 * />
 * ```
 */
export function StashButton({
  onClick,
  isStashed = false,
  size = 'medium',
  tooltip,
  className = '',
  disabled = false,
  ariaLabel,
}: StashButtonProps) {
  const [isAnimating, setIsAnimating] = useState(false)

  const handleClick = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation() // Prevent event bubbling

      // Trigger animation
      setIsAnimating(true)
      setTimeout(() => setIsAnimating(false), 300)

      onClick(e)
    },
    [onClick]
  )

  const tooltipText = tooltip || (isStashed ? 'Already in Stash' : 'Add to Stash')
  const label = ariaLabel || tooltipText

  return (
    <button
      className={`
        ${styles.button}
        ${styles[size]}
        ${isStashed ? styles.stashed : ''}
        ${isAnimating ? styles.animating : ''}
        ${className}
      `.trim()}
      onClick={handleClick}
      disabled={disabled || isStashed}
      aria-label={label}
      title={tooltipText}
      type="button"
    >
      <span className={styles.icon} aria-hidden="true">
        {isStashed ? '★' : '☆'}
      </span>
    </button>
  )
}
