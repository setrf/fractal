/**
 * MarkdownWithHighlights Component
 * =================================
 * 
 * Renders markdown content with concept highlighting.
 * Uses a pre-processing approach to insert HTML mark elements into the content,
 * then uses rehype-raw to parse and render them properly.
 */

import { useCallback, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import type { ExtractedConcept, ConceptCategory } from '../../api'
import styles from './MarkdownWithHighlights.module.css'

/**
 * Props for the MarkdownWithHighlights component.
 */
export interface MarkdownWithHighlightsProps {
  /** The markdown content to render */
  content: string
  
  /** Array of concepts to highlight */
  concepts: ExtractedConcept[]
  
  /** Called when a concept is hovered */
  onConceptHover?: (concept: ExtractedConcept, event: React.MouseEvent) => void
  
  /** Called when mouse leaves a concept */
  onConceptLeave?: (concept: ExtractedConcept) => void
  
  /** Called when a concept is clicked */
  onConceptClick?: (concept: ExtractedConcept, event: React.MouseEvent) => void
  
  /** Called when a concept's remove button is clicked */
  onConceptRemove?: (conceptId: string) => void
  
  /** Additional CSS class */
  className?: string
}

/**
 * Get CSS class name for a concept category.
 */
function getCategoryClassName(category: ConceptCategory): string {
  const classes: Record<ConceptCategory, string> = {
    science: 'category-science',
    philosophy: 'category-philosophy',
    psychology: 'category-psychology',
    technology: 'category-technology',
    abstract: 'category-abstract',
  }
  return classes[category] || 'category-abstract'
}

/**
 * Insert mark elements into content by searching for concept text.
 * Uses text matching instead of indices for more reliable highlighting.
 * Returns the content with HTML mark tags embedded.
 */
function insertMarkElements(content: string, concepts: ExtractedConcept[]): string {
  if (concepts.length === 0) return content
  
  // Sort concepts by text length (descending) so longer phrases match first
  const sortedConcepts = [...concepts].sort((a, b) => b.text.length - a.text.length)
  
  let result = content
  const usedConcepts = new Set<string>()
  
  for (const concept of sortedConcepts) {
    // Skip if already used
    if (usedConcepts.has(concept.id)) continue
    
    // Find the concept text in the content (case-insensitive)
    const lowerContent = result.toLowerCase()
    const lowerText = concept.text.toLowerCase()
    
    // Find all occurrences
    let pos = 0
    let matchIndex = -1
    
    // Find the occurrence closest to the original startIndex if provided
    let bestMatch = -1
    let bestDistance = Infinity
    
    while ((pos = lowerContent.indexOf(lowerText, pos)) !== -1) {
      const distance = Math.abs(pos - concept.startIndex)
      if (distance < bestDistance) {
        bestDistance = distance
        bestMatch = pos
      }
      pos += 1
    }
    
    matchIndex = bestMatch
    
    if (matchIndex === -1) continue
    
    // Get the actual text (preserving case)
    const actualText = result.slice(matchIndex, matchIndex + concept.text.length)
    
    // Create the mark element as raw HTML
    const categoryClass = getCategoryClassName(concept.category)
    const markHtml = `<mark class="concept-highlight ${categoryClass}" data-concept-id="${concept.id}" data-concept-name="${concept.normalizedName}" data-concept-category="${concept.category}">${actualText}</mark>`
    
    // Insert the mark
    result = result.slice(0, matchIndex) + markHtml + result.slice(matchIndex + concept.text.length)
    usedConcepts.add(concept.id)
  }
  
  return result
}

/**
 * MarkdownWithHighlights renders markdown with interactive concept highlights.
 */
export function MarkdownWithHighlights({
  content,
  concepts,
  onConceptHover,
  onConceptLeave,
  onConceptClick,
  onConceptRemove,
  className = '',
}: MarkdownWithHighlightsProps) {
  // Pre-process content to insert mark elements
  const processedContent = useMemo(() => {
    return insertMarkElements(content, concepts)
  }, [content, concepts])
  
  // Handle clicks on highlight marks
  const handleClick = useCallback((event: React.MouseEvent) => {
    const target = event.target as HTMLElement
    const mark = target.closest('mark[data-concept-id]')
    if (!mark) return
    
    const conceptId = mark.getAttribute('data-concept-id')
    const concept = concepts.find(c => c.id === conceptId)
    if (concept && onConceptClick) {
      event.preventDefault()
      event.stopPropagation()
      onConceptClick(concept, event)
    }
  }, [concepts, onConceptClick])
  
  // Handle hover on highlight marks
  const handleMouseOver = useCallback((event: React.MouseEvent) => {
    const target = event.target as HTMLElement
    const mark = target.closest('mark[data-concept-id]')
    if (!mark) return
    
    const conceptId = mark.getAttribute('data-concept-id')
    const concept = concepts.find(c => c.id === conceptId)
    if (concept && onConceptHover) {
      onConceptHover(concept, event)
    }
  }, [concepts, onConceptHover])
  
  // Handle mouse leave on highlight marks
  const handleMouseOut = useCallback((event: React.MouseEvent) => {
    const target = event.target as HTMLElement
    const mark = target.closest('mark[data-concept-id]')
    if (!mark) return
    
    const conceptId = mark.getAttribute('data-concept-id')
    const concept = concepts.find(c => c.id === conceptId)
    if (concept && onConceptLeave) {
      onConceptLeave(concept)
    }
  }, [concepts, onConceptLeave])
  
  // Handle remove button clicks (on dynamically added buttons)
  const handleRemoveClick = useCallback((event: React.MouseEvent) => {
    const target = event.target as HTMLElement
    if (!target.classList.contains(styles.removeBtn)) return
    
    event.preventDefault()
    event.stopPropagation()
    
    const conceptId = target.getAttribute('data-remove-concept')
    if (conceptId && onConceptRemove) {
      onConceptRemove(conceptId)
    }
  }, [onConceptRemove])
  
  return (
    <div 
      className={`${styles.container} ${className}`.trim()}
      onClick={handleClick}
      onMouseOver={handleMouseOver}
      onMouseOut={handleMouseOut}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          // Custom renderer for mark elements to add remove buttons
          mark: ({ node, children, ...props }) => {
            const conceptId = (props as Record<string, unknown>)['data-concept-id'] as string
            return (
              <mark {...props} className={`${styles.highlight} ${(props as Record<string, unknown>)['className'] || ''}`}>
                {children}
                {onConceptRemove && (
                  <button
                    className={styles.removeBtn}
                    data-remove-concept={conceptId}
                    onClick={handleRemoveClick as unknown as React.MouseEventHandler<HTMLButtonElement>}
                    aria-label="Remove highlight"
                    title="Remove"
                  >
                    ×
                  </button>
                )}
              </mark>
            )
          },
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  )
}
