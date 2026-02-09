/**
 * MarkdownWithHighlights Component
 * =================================
 * 
 * Renders markdown content with concept highlighting.
 * Uses a pre-processing approach to insert HTML mark elements into the content,
 * then uses rehype-raw to parse and render them properly.
 */

import { Children, useCallback, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
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

const highlightSanitizeSchema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames || []),
    'mark',
  ],
  attributes: {
    ...defaultSchema.attributes,
    mark: [
      ...((defaultSchema.attributes && defaultSchema.attributes.mark) || []),
      'className',
      'class',
      'data-concept-id',
      'data-concept-name',
      'data-concept-category',
    ],
  },
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function escapeHtmlAttribute(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
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

  const lowerContent = content.toLowerCase()
  const occupiedRanges: Array<{ start: number; end: number }> = []
  const matches: Array<{ concept: ExtractedConcept; index: number }> = []

  const isRangeAvailable = (start: number, end: number): boolean => {
    return !occupiedRanges.some(range => start < range.end && end > range.start)
  }

  for (const concept of sortedConcepts) {
    const lowerText = concept.text.toLowerCase()

    // Find the best non-overlapping occurrence closest to startIndex.
    let pos = 0
    let bestMatch = -1
    let bestDistance = Infinity

    while ((pos = lowerContent.indexOf(lowerText, pos)) !== -1) {
      const end = pos + concept.text.length
      if (!isRangeAvailable(pos, end)) {
        pos += 1
        continue
      }

      const distance = Math.abs(pos - concept.startIndex)
      if (distance < bestDistance) {
        bestDistance = distance
        bestMatch = pos
      }
      pos += 1
    }

    if (bestMatch !== -1) {
      matches.push({ concept, index: bestMatch })
      occupiedRanges.push({ start: bestMatch, end: bestMatch + concept.text.length })
    }
  }

  // Apply replacements from right to left to keep indices stable.
  const sortedMatches = matches.sort((a, b) => b.index - a.index)
  let result = content

  for (const { concept, index } of sortedMatches) {
    const actualText = escapeHtml(content.slice(index, index + concept.text.length))
    const categoryClass = getCategoryClassName(concept.category)
    const markHtml = `<mark class="concept-highlight ${categoryClass}" data-concept-id="${escapeHtmlAttribute(concept.id)}" data-concept-name="${escapeHtmlAttribute(concept.normalizedName)}" data-concept-category="${escapeHtmlAttribute(concept.category)}">${actualText}</mark>`
    result = result.slice(0, index) + markHtml + result.slice(index + concept.text.length)
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
  const resolveConceptFromMark = useCallback((mark: Element): ExtractedConcept | undefined => {
    const conceptId = mark.getAttribute('data-concept-id')
    if (conceptId) {
      return concepts.find(c => c.id === conceptId)
    }

    const conceptName = mark.getAttribute('data-concept-name')
    if (conceptName) {
      const normalized = conceptName.toLowerCase()
      return concepts.find(c => c.normalizedName.toLowerCase() === normalized)
    }

    const text = (mark.textContent || '').replace('×', '').trim()
    if (!text) return undefined
    const lowerText = text.toLowerCase()
    return concepts.find(c =>
      c.text.toLowerCase() === lowerText || c.normalizedName.toLowerCase() === lowerText
    )
  }, [concepts])

  const handleClick = useCallback((event: React.MouseEvent) => {
    if (!(event.target instanceof Element)) return
    const mark = event.target.closest('mark.concept-highlight')
    if (!mark) return

    const concept = resolveConceptFromMark(mark)
    if (concept && onConceptClick) {
      event.preventDefault()
      event.stopPropagation()
      onConceptClick(concept, event)
    }
  }, [onConceptClick, resolveConceptFromMark])
  
  // Handle hover on highlight marks
  const handleMouseOver = useCallback((event: React.MouseEvent) => {
    if (!(event.target instanceof Element)) return
    const mark = event.target.closest('mark.concept-highlight')
    if (!mark) return

    const concept = resolveConceptFromMark(mark)
    if (concept && onConceptHover) {
      onConceptHover(concept, event)
    }
  }, [onConceptHover, resolveConceptFromMark])
  
  // Handle mouse leave on highlight marks
  const handleMouseOut = useCallback((event: React.MouseEvent) => {
    if (!(event.target instanceof Element)) return
    const mark = event.target.closest('mark.concept-highlight')
    if (!mark) return

    const concept = resolveConceptFromMark(mark)
    if (concept && onConceptLeave) {
      onConceptLeave(concept)
    }
  }, [onConceptLeave, resolveConceptFromMark])
  
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
        rehypePlugins={[rehypeRaw, [rehypeSanitize, highlightSanitizeSchema]]}
        components={{
          // Custom renderer for mark elements to add remove buttons
          mark: ({ children, ...props }) => {
            const markProps = props as Record<string, unknown>
            const explicitConceptId = (markProps['data-concept-id'] ?? markProps['dataConceptId']) as string | undefined
            const conceptName = (markProps['data-concept-name'] ?? markProps['dataConceptName']) as string | undefined
            const conceptCategory = (markProps['data-concept-category'] ?? markProps['dataConceptCategory']) as string | undefined

            const markText = Children.toArray(children)
              .map(child => (typeof child === 'string' ? child : ''))
              .join('')
              .replace('×', '')
              .trim()

            const fallbackConcept = concepts.find(c =>
              (conceptName && c.normalizedName.toLowerCase() === conceptName.toLowerCase()) ||
              (markText &&
                (c.text.toLowerCase() === markText.toLowerCase() ||
                  c.normalizedName.toLowerCase() === markText.toLowerCase()))
            )

            const conceptId = explicitConceptId || fallbackConcept?.id
            return (
              <mark
                {...props}
                className={`${styles.highlight} ${markProps['className'] || ''}`}
                data-concept-id={conceptId}
                data-concept-name={conceptName || fallbackConcept?.normalizedName}
                data-concept-category={conceptCategory || fallbackConcept?.category}
              >
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
