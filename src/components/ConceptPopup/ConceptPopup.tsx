/**
 * ConceptPopup Component
 * ======================
 * 
 * A Gwern-style popup for displaying concept explanations.
 * Moveable, resizable, and stays open until explicitly closed.
 * 
 * Features:
 * - Draggable by header - move anywhere on screen
 * - Resizable by edges/corners - adjust to preferred size
 * - Stays open until close button clicked (persistent)
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
 * Size for the popup.
 */
export interface PopupSize {
  width: number
  height: number
}

/**
 * Minimum popup dimensions.
 */
const MIN_WIDTH = 280
const MIN_HEIGHT = 200
const DEFAULT_WIDTH = 320
const DEFAULT_HEIGHT = 400

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
 * - Draggable by header
 * - Resizable by edges and corners
 * - Stays open until explicitly closed
 * - Intelligent initial positioning
 * - Loading and error states
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
  const headerRef = useRef<HTMLDivElement>(null)
  
  // Position and size state
  const [popupPosition, setPopupPosition] = useState(position)
  const [popupSize, setPopupSize] = useState<PopupSize>({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT })
  
  // Drag state
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  
  // Resize state
  const [isResizing, setIsResizing] = useState(false)
  const [resizeEdge, setResizeEdge] = useState<string | null>(null)
  const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0, left: 0, top: 0 })

  // Initial position adjustment to stay within viewport
  useEffect(() => {
    if (!popupRef.current || !concept) return

    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    let newX = position.x
    let newY = position.y

    // Horizontal adjustment
    if (position.x + popupSize.width > viewportWidth - 20) {
      newX = viewportWidth - popupSize.width - 20
    }
    if (newX < 20) {
      newX = 20
    }

    // Vertical adjustment
    if (position.y + popupSize.height > viewportHeight - 20) {
      newY = position.y - popupSize.height - 10
    }
    if (newY < 20) {
      newY = 20
    }

    setPopupPosition({ x: newX, y: newY })
  }, [position, concept, popupSize.width, popupSize.height])

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

  // ===== DRAG HANDLERS =====
  
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    // Only drag from header, not from buttons
    if ((e.target as HTMLElement).closest('button')) return
    
    e.preventDefault()
    setIsDragging(true)
    setDragOffset({
      x: e.clientX - popupPosition.x,
      y: e.clientY - popupPosition.y,
    })
  }, [popupPosition])

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const newX = Math.max(0, Math.min(e.clientX - dragOffset.x, window.innerWidth - popupSize.width))
      const newY = Math.max(0, Math.min(e.clientY - dragOffset.y, window.innerHeight - 50))
      setPopupPosition({ x: newX, y: newY })
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, dragOffset, popupSize.width])

  // ===== RESIZE HANDLERS =====

  const handleResizeStart = useCallback((e: React.MouseEvent, edge: string) => {
    e.preventDefault()
    e.stopPropagation()
    setIsResizing(true)
    setResizeEdge(edge)
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      width: popupSize.width,
      height: popupSize.height,
      left: popupPosition.x,
      top: popupPosition.y,
    }
  }, [popupSize, popupPosition])

  useEffect(() => {
    if (!isResizing || !resizeEdge) return

    const handleMouseMove = (e: MouseEvent) => {
      const start = resizeStartRef.current
      const deltaX = e.clientX - start.x
      const deltaY = e.clientY - start.y

      let newWidth = start.width
      let newHeight = start.height
      let newLeft = start.left
      let newTop = start.top

      // Handle horizontal resizing
      if (resizeEdge.includes('e')) {
        newWidth = Math.max(MIN_WIDTH, start.width + deltaX)
      }
      if (resizeEdge.includes('w')) {
        const potentialWidth = start.width - deltaX
        if (potentialWidth >= MIN_WIDTH) {
          newWidth = potentialWidth
          newLeft = start.left + deltaX
        }
      }

      // Handle vertical resizing
      if (resizeEdge.includes('s')) {
        newHeight = Math.max(MIN_HEIGHT, start.height + deltaY)
      }
      if (resizeEdge.includes('n')) {
        const potentialHeight = start.height - deltaY
        if (potentialHeight >= MIN_HEIGHT) {
          newHeight = potentialHeight
          newTop = start.top + deltaY
        }
      }

      setPopupSize({ width: newWidth, height: newHeight })
      setPopupPosition({ x: newLeft, y: newTop })
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      setResizeEdge(null)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing, resizeEdge])

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
      className={`${styles.popup} ${isSticky ? styles.sticky : ''} ${isDragging ? styles.dragging : ''} ${isResizing ? styles.resizing : ''}`}
      style={{
        left: popupPosition.x,
        top: popupPosition.y,
        width: popupSize.width,
        height: popupSize.height,
      }}
      role="dialog"
      aria-label={`Concept explanation: ${concept.normalizedName}`}
      aria-live="polite"
    >
      {/* Resize handles */}
      <div className={`${styles.resizeHandle} ${styles.resizeN}`} onMouseDown={(e) => handleResizeStart(e, 'n')} />
      <div className={`${styles.resizeHandle} ${styles.resizeS}`} onMouseDown={(e) => handleResizeStart(e, 's')} />
      <div className={`${styles.resizeHandle} ${styles.resizeE}`} onMouseDown={(e) => handleResizeStart(e, 'e')} />
      <div className={`${styles.resizeHandle} ${styles.resizeW}`} onMouseDown={(e) => handleResizeStart(e, 'w')} />
      <div className={`${styles.resizeHandle} ${styles.resizeNE}`} onMouseDown={(e) => handleResizeStart(e, 'ne')} />
      <div className={`${styles.resizeHandle} ${styles.resizeNW}`} onMouseDown={(e) => handleResizeStart(e, 'nw')} />
      <div className={`${styles.resizeHandle} ${styles.resizeSE}`} onMouseDown={(e) => handleResizeStart(e, 'se')} />
      <div className={`${styles.resizeHandle} ${styles.resizeSW}`} onMouseDown={(e) => handleResizeStart(e, 'sw')} />
      
      {/* Header - draggable area */}
      <div 
        ref={headerRef}
        className={`${styles.header} ${styles.draggableHeader}`}
        onMouseDown={handleDragStart}
      >
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
