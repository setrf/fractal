/**
 * ConceptHighlighter Component
 * ============================
 * 
 * Renders text with highlighted concept spans.
 * Each concept is color-coded by category and triggers popups on interaction.
 * 
 * @example
 * ```tsx
 * <ConceptHighlighter
 *   text="Why do we dream during sleep?"
 *   concepts={[
 *     { id: 'c_1', text: 'dream', category: 'psychology', startIndex: 10, endIndex: 15, ... }
 *   ]}
 *   onConceptHover={(concept) => console.log('Hovered:', concept.text)}
 *   onConceptClick={(concept) => console.log('Clicked:', concept.text)}
 * />
 * ```
 */

import { useCallback, useMemo } from 'react'
import type { ExtractedConcept, ConceptCategory } from '../../api'
import styles from './ConceptHighlighter.module.css'

/**
 * Props for the ConceptHighlighter component.
 */
export interface ConceptHighlighterProps {
  /** The source text to render with highlights */
  text: string
  
  /** Array of extracted concepts to highlight */
  concepts: ExtractedConcept[]
  
  /** Called when a concept is hovered (mouse enter) */
  onConceptHover?: (concept: ExtractedConcept, event: React.MouseEvent) => void
  
  /** Called when mouse leaves a concept */
  onConceptLeave?: (concept: ExtractedConcept) => void
  
  /** Called when a concept is clicked */
  onConceptClick?: (concept: ExtractedConcept, event: React.MouseEvent) => void
  
  /** Called when a concept's remove button is clicked */
  onConceptRemove?: (conceptId: string) => void
  
  /** Additional CSS class for the container */
  className?: string
  
  /** Whether concepts are interactive (default: true) */
  interactive?: boolean
}

/**
 * A segment of text - either plain text or a concept.
 */
interface TextSegment {
  type: 'text' | 'concept'
  content: string
  concept?: ExtractedConcept
}

/**
 * Get CSS class name for a concept category.
 */
function getCategoryClassName(category: ConceptCategory): string {
  const categoryClasses: Record<ConceptCategory, string> = {
    science: styles.categoryScience,
    philosophy: styles.categoryPhilosophy,
    psychology: styles.categoryPsychology,
    technology: styles.categoryTechnology,
    abstract: styles.categoryAbstract,
  }
  return categoryClasses[category] || styles.categoryAbstract
}

/**
 * Segment text into plain text and concept spans.
 * Concepts must be sorted by startIndex and non-overlapping.
 */
function segmentText(text: string, concepts: ExtractedConcept[]): TextSegment[] {
  if (!concepts.length) {
    return [{ type: 'text', content: text }]
  }

  const segments: TextSegment[] = []
  let currentIndex = 0

  // Sort concepts by start position
  const sortedConcepts = [...concepts].sort((a, b) => a.startIndex - b.startIndex)

  for (const concept of sortedConcepts) {
    // Validate indices
    if (concept.startIndex < currentIndex || concept.endIndex > text.length) {
      console.warn(`[ConceptHighlighter] Invalid concept indices for "${concept.text}"`)
      continue
    }

    // Add plain text before this concept
    if (concept.startIndex > currentIndex) {
      segments.push({
        type: 'text',
        content: text.slice(currentIndex, concept.startIndex),
      })
    }

    // Add the concept segment
    segments.push({
      type: 'concept',
      content: text.slice(concept.startIndex, concept.endIndex),
      concept,
    })

    currentIndex = concept.endIndex
  }

  // Add any remaining text after the last concept
  if (currentIndex < text.length) {
    segments.push({
      type: 'text',
      content: text.slice(currentIndex),
    })
  }

  return segments
}

/**
 * ConceptHighlighter renders text with highlighted concept spans.
 * 
 * Features:
 * - Color-coded highlights by concept category
 * - Hover and click interactions for popup triggers
 * - Accessible with proper ARIA attributes
 * - Keyboard navigation support
 */
export function ConceptHighlighter({
  text,
  concepts,
  onConceptHover,
  onConceptLeave,
  onConceptClick,
  onConceptRemove,
  className = '',
  interactive = true,
}: ConceptHighlighterProps) {
  // Memoize text segmentation
  const segments = useMemo(
    () => segmentText(text, concepts),
    [text, concepts]
  )

  // Event handlers
  const handleMouseEnter = useCallback(
    (concept: ExtractedConcept, event: React.MouseEvent) => {
      if (interactive && onConceptHover) {
        onConceptHover(concept, event)
      }
    },
    [interactive, onConceptHover]
  )

  const handleMouseLeave = useCallback(
    (concept: ExtractedConcept) => {
      if (interactive && onConceptLeave) {
        onConceptLeave(concept)
      }
    },
    [interactive, onConceptLeave]
  )

  const handleClick = useCallback(
    (concept: ExtractedConcept, event: React.MouseEvent) => {
      if (interactive && onConceptClick) {
        event.preventDefault()
        onConceptClick(concept, event)
      }
    },
    [interactive, onConceptClick]
  )

  const handleKeyDown = useCallback(
    (concept: ExtractedConcept, event: React.KeyboardEvent) => {
      if (interactive && onConceptClick && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault()
        // Create a synthetic mouse event for consistency
        onConceptClick(concept, event as unknown as React.MouseEvent)
      }
    },
    [interactive, onConceptClick]
  )

  const handleRemove = useCallback(
    (conceptId: string, event: React.MouseEvent) => {
      event.stopPropagation()
      event.preventDefault()
      if (onConceptRemove) {
        onConceptRemove(conceptId)
      }
    },
    [onConceptRemove]
  )

  return (
    <span className={`${styles.container} ${className}`.trim()}>
      {segments.map((segment, index) => {
        if (segment.type === 'text') {
          return (
            <span key={index} className={styles.plainText}>
              {segment.content}
            </span>
          )
        }

        const concept = segment.concept!
        const categoryClass = getCategoryClassName(concept.category)

        return (
          <span
            key={concept.id}
            className={`${styles.concept} ${categoryClass} ${interactive ? styles.interactive : ''}`.trim()}
            data-concept-id={concept.id}
            data-concept-name={concept.normalizedName}
            data-concept-category={concept.category}
            role={interactive ? 'button' : undefined}
            tabIndex={interactive ? 0 : undefined}
            aria-label={interactive ? `Explore concept: ${concept.normalizedName}` : undefined}
            onMouseEnter={(e) => handleMouseEnter(concept, e)}
            onMouseLeave={() => handleMouseLeave(concept)}
            onClick={(e) => handleClick(concept, e)}
            onKeyDown={(e) => handleKeyDown(concept, e)}
          >
            {segment.content}
            {onConceptRemove && (
              <button
                className={styles.removeBtn}
                onClick={(e) => handleRemove(concept.id, e)}
                aria-label={`Remove highlight: ${concept.normalizedName}`}
                title="Remove"
              >
                ×
              </button>
            )}
          </span>
        )
      })}
    </span>
  )
}

/**
 * Utility: Check if concepts array is valid for highlighting.
 */
export function validateConcepts(text: string, concepts: ExtractedConcept[]): boolean {
  if (!concepts.length) return true

  const sorted = [...concepts].sort((a, b) => a.startIndex - b.startIndex)

  for (let i = 0; i < sorted.length; i++) {
    const concept = sorted[i]
    
    // Check bounds
    if (concept.startIndex < 0 || concept.endIndex > text.length) {
      return false
    }
    
    // Check for overlap with previous
    if (i > 0 && concept.startIndex < sorted[i - 1].endIndex) {
      return false
    }
  }

  return true
}
