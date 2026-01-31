/**
 * ConceptPopup Component
 * ======================
 * 
 * A Gwern-style popup for displaying concept explanations.
 * Appears on hover/click and can be "stickied" (pinned) by clicking.
 * 
 * Inspired by Gwern.net's popup paradigm:
 * - Appears on hover with slight delay
 * - Can be pinned by clicking
 * - Positioned intelligently to avoid viewport edges
 * - Contains contextual explanations with related concepts
 * 
 * @example
 * ```tsx
 * <ConceptPopup
 *   concept={hoveredConcept}
 *   explanation={explanation}
 *   isLoading={isLoading}
 *   position={{ x: 100, y: 200 }}
 *   onClose={() => setHoveredConcept(null)}
 *   onRelatedConceptClick={(name) => console.log('Explore:', name)}
 * />
 * ```
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import type { ExtractedConcept, ConceptExplanation, ConceptCategory } from '../../api'
import styles from './ConceptPopup.module.css'

/**
 * Position for the popup.
 */
export interface PopupPosition {
  x: number
  y: number
}

/**
 * Props for the ConceptPopup component.
 */
export interface ConceptPopupProps {
  /** The concept being explained */
  concept: ExtractedConcept | null
  
  /** The explanation content (null if still loading) */
  explanation: ConceptExplanation | null
  
  /** Whether the explanation is loading */
  isLoading: boolean
  
  /** Error message if explanation failed to load */
  error?: string | null
  
  /** Position to display the popup */
  position: PopupPosition
  
  /** Whether the popup is "stickied" (pinned) */
  isSticky?: boolean
  
  /** Called when popup should close */
  onClose: () => void
  
  /** Called when a related concept is clicked */
  onRelatedConceptClick?: (conceptName: string) => void
  
  /** Called when sticky state changes */
  onStickyChange?: (isSticky: boolean) => void
  
  /** Called when user wants to remove this highlight */
  onRemove?: (conceptId: string) => void
}

/**
 * Category labels for display.
 */
const categoryLabels: Record<ConceptCategory, string> = {
  science: 'Science',
  philosophy: 'Philosophy',
  psychology: 'Psychology',
  technology: 'Technology',
  abstract: 'Concept',
}

/**
 * ConceptPopup displays contextual explanations for highlighted concepts.
 * 
 * Features:
 * - Intelligent positioning to stay within viewport
 * - Loading and error states
 * - Sticky/pin functionality
 * - Related concepts for further exploration
 * - Keyboard accessible (Escape to close)
 */
export function ConceptPopup({
  concept,
  explanation,
  isLoading,
  error,
  position,
  isSticky = false,
  onClose,
  onRelatedConceptClick,
  onStickyChange,
  onRemove,
}: ConceptPopupProps) {
  const popupRef = useRef<HTMLDivElement>(null)
  const [adjustedPosition, setAdjustedPosition] = useState(position)

  // Adjust position to stay within viewport
  useEffect(() => {
    if (!popupRef.current || !concept) return

    const popup = popupRef.current
    const rect = popup.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    let newX = position.x
    let newY = position.y

    // Horizontal adjustment
    if (position.x + rect.width > viewportWidth - 20) {
      newX = viewportWidth - rect.width - 20
    }
    if (newX < 20) {
      newX = 20
    }

    // Vertical adjustment - prefer below, but flip if needed
    if (position.y + rect.height > viewportHeight - 20) {
      // Try positioning above
      newY = position.y - rect.height - 10
    }
    if (newY < 20) {
      newY = 20
    }

    setAdjustedPosition({ x: newX, y: newY })
  }, [position, concept])

  // Handle Escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Handle click outside to close (only when sticky)
  useEffect(() => {
    if (!isSticky) return

    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    // Delay to prevent immediate closing
    const timeoutId = setTimeout(() => {
      document.addEventListener('click', handleClickOutside)
    }, 100)

    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener('click', handleClickOutside)
    }
  }, [isSticky, onClose])

  // Toggle sticky state
  const handlePinClick = useCallback(() => {
    if (onStickyChange) {
      onStickyChange(!isSticky)
    }
  }, [isSticky, onStickyChange])

  // Handle related concept click
  const handleRelatedClick = useCallback(
    (name: string) => {
      if (onRelatedConceptClick) {
        onRelatedConceptClick(name)
      }
    },
    [onRelatedConceptClick]
  )

  // Handle remove highlight
  const handleRemove = useCallback(() => {
    if (onRemove && concept) {
      onRemove(concept.id)
      onClose()
    }
  }, [onRemove, concept, onClose])

  // Don't render if no concept
  if (!concept) return null

  const categoryLabel = categoryLabels[concept.category]

  return (
    <div
      ref={popupRef}
      className={`${styles.popup} ${isSticky ? styles.sticky : ''}`}
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
      }}
      role="tooltip"
      aria-live="polite"
    >
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <span className={styles.conceptName}>{concept.normalizedName}</span>
          <span className={`${styles.category} ${styles[`category${concept.category.charAt(0).toUpperCase() + concept.category.slice(1)}`]}`}>
            {categoryLabel}
          </span>
        </div>
        <div className={styles.actions}>
          {onRemove && (
            <button
              className={styles.removeButton}
              onClick={handleRemove}
              aria-label="Remove highlight"
              title="Remove this highlight"
            >
              🗑
            </button>
          )}
          {onStickyChange && (
            <button
              className={`${styles.pinButton} ${isSticky ? styles.pinned : ''}`}
              onClick={handlePinClick}
              aria-label={isSticky ? 'Unpin popup' : 'Pin popup'}
              title={isSticky ? 'Unpin' : 'Pin'}
            >
              {isSticky ? '◉' : '○'}
            </button>
          )}
          <button
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close popup"
          >
            ×
          </button>
        </div>
      </div>

      {/* Content */}
      <div className={styles.content}>
        {isLoading && (
          <div className={styles.loading}>
            <span className={styles.loadingDot}>◌</span>
            <span>Loading explanation...</span>
          </div>
        )}

        {error && !isLoading && (
          <div className={styles.error}>
            <span className={styles.errorIcon}>!</span>
            <span>{error}</span>
          </div>
        )}

        {explanation && !isLoading && !error && (
          <>
            {/* Summary */}
            <div className={styles.section}>
              <p className={styles.summary}>{explanation.summary}</p>
            </div>

            {/* Context */}
            <div className={styles.section}>
              <h4 className={styles.sectionTitle}>In Context</h4>
              <p className={styles.context}>{explanation.context}</p>
            </div>

            {/* Related Concepts */}
            {explanation.relatedConcepts.length > 0 && (
              <div className={styles.section}>
                <h4 className={styles.sectionTitle}>Related</h4>
                <div className={styles.relatedList}>
                  {explanation.relatedConcepts.map((name) => (
                    <button
                      key={name}
                      className={styles.relatedConcept}
                      onClick={() => handleRelatedClick(name)}
                      title={`Explore: ${name}`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
