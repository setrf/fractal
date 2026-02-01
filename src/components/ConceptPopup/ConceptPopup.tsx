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
import { extractConcepts } from '../../api'
import { ConceptHighlighter } from '../ConceptHighlighter'
import { StashButton } from '../StashButton'
import { useStashContext } from '../../context/StashContext'
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
export const DEFAULT_POPUP_WIDTH = 320
export const DEFAULT_POPUP_HEIGHT = 400

/**
 * Minimized popup dimensions for stacking.
 * Height is set to 'auto' to fit header content, so we use estimated height for stacking.
 */
const MINIMIZED_WIDTH = 220
const MINIMIZED_ESTIMATED_HEIGHT = 70  // Approximate header height (includes padding + category badge)
const STACK_MARGIN = 8
const STACK_RIGHT_OFFSET = 20  // Offset from right edge (avoids stash sidebar)
const STACK_BOTTOM_OFFSET = 20

/**
 * Spacing between popups when avoiding overlap.
 */
const POPUP_SPACING = 20

/**
 * Finds a non-overlapping position for a new popup.
 * Tries the initial position first, then offsets to avoid existing popups.
 * 
 * @param initialX - Preferred X position (e.g., from mouse click)
 * @param initialY - Preferred Y position
 * @param existingPopups - Array of existing popup positions and sizes
 * @param popupWidth - Width of the new popup (default: DEFAULT_POPUP_WIDTH)
 * @param popupHeight - Height of the new popup (default: DEFAULT_POPUP_HEIGHT)
 * @returns Non-overlapping position { x, y }
 */
export function findNonOverlappingPosition(
  initialX: number,
  initialY: number,
  existingPopups: Array<{ x: number; y: number; width?: number; height?: number; isMinimized?: boolean }>,
  popupWidth: number = DEFAULT_POPUP_WIDTH,
  popupHeight: number = DEFAULT_POPUP_HEIGHT
): PopupPosition {
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  
  // Filter out minimized popups (they're in the corner, not blocking main area)
  const activePopups = existingPopups.filter(p => !p.isMinimized)
  
  // If no active popups, just ensure we're within viewport bounds
  if (activePopups.length === 0) {
    return {
      x: Math.min(Math.max(20, initialX), viewportWidth - popupWidth - 20),
      y: Math.min(Math.max(20, initialY), viewportHeight - popupHeight - 20),
    }
  }
  
  /**
   * Check if a position overlaps with any existing popup.
   */
  const overlapsAny = (x: number, y: number): boolean => {
    const newRect = {
      left: x,
      right: x + popupWidth,
      top: y,
      bottom: y + popupHeight,
    }
    
    return activePopups.some(popup => {
      const existingRect = {
        left: popup.x,
        right: popup.x + (popup.width || DEFAULT_POPUP_WIDTH),
        top: popup.y,
        bottom: popup.y + (popup.height || DEFAULT_POPUP_HEIGHT),
      }
      
      // Check for overlap
      return !(
        newRect.right < existingRect.left ||
        newRect.left > existingRect.right ||
        newRect.bottom < existingRect.top ||
        newRect.top > existingRect.bottom
      )
    })
  }
  
  /**
   * Clamp position to viewport bounds.
   */
  const clamp = (x: number, y: number): PopupPosition => ({
    x: Math.min(Math.max(20, x), viewportWidth - popupWidth - 20),
    y: Math.min(Math.max(20, y), viewportHeight - popupHeight - 20),
  })
  
  // Try initial position
  let pos = clamp(initialX, initialY)
  if (!overlapsAny(pos.x, pos.y)) {
    return pos
  }
  
  // Try offsetting to the right of existing popups
  const rightmostPopup = activePopups.reduce((max, p) => 
    Math.max(max, p.x + (p.width || DEFAULT_POPUP_WIDTH)), 0
  )
  pos = clamp(rightmostPopup + POPUP_SPACING, initialY)
  if (!overlapsAny(pos.x, pos.y)) {
    return pos
  }
  
  // Try offsetting below existing popups
  const bottommostPopup = activePopups.reduce((max, p) => 
    Math.max(max, p.y + (p.height || DEFAULT_POPUP_HEIGHT)), 0
  )
  pos = clamp(initialX, bottommostPopup + POPUP_SPACING)
  if (!overlapsAny(pos.x, pos.y)) {
    return pos
  }
  
  // Try left of leftmost popup
  const leftmostPopup = activePopups.reduce((min, p) => Math.min(min, p.x), viewportWidth)
  pos = clamp(leftmostPopup - popupWidth - POPUP_SPACING, initialY)
  if (!overlapsAny(pos.x, pos.y)) {
    return pos
  }
  
  // Try cascading position (offset from last popup)
  const lastPopup = activePopups[activePopups.length - 1]
  pos = clamp(lastPopup.x + 40, lastPopup.y + 40)
  if (!overlapsAny(pos.x, pos.y)) {
    return pos
  }
  
  // Fallback: use cascading position even if it overlaps
  return pos
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
  
  /** Called when popup should close */
  onClose: () => void
  
  /** Called when a related concept is clicked */
  onRelatedConceptClick?: (conceptName: string) => void
  
  /** Called when minimize state changes (for stacking management) */
  onMinimizeChange?: (conceptId: string, isMinimized: boolean) => void
  
  /** Stack index when minimized (0 = bottom, 1 = above, etc.) */
  minimizedStackIndex?: number
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
  onClose,
  onRelatedConceptClick,
  onMinimizeChange,
  minimizedStackIndex = 0,
}: ConceptPopupProps) {
  const popupRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  
  // Stash context for adding explanations to stash
  const { addItem, hasItem } = useStashContext()
  
  // Position and size state
  const [popupPosition, setPopupPosition] = useState(position)
  const [popupSize, setPopupSize] = useState<PopupSize>({ width: DEFAULT_POPUP_WIDTH, height: DEFAULT_POPUP_HEIGHT })
  
  // Minimize state - stores previous height and position when minimized
  const [isMinimized, setIsMinimized] = useState(false)
  const [preMinimizeHeight, setPreMinimizeHeight] = useState(DEFAULT_POPUP_HEIGHT)
  const [preMinimizePosition, setPreMinimizePosition] = useState<PopupPosition | null>(null)
  const [preMinimizeWidth, setPreMinimizeWidth] = useState(DEFAULT_POPUP_WIDTH)
  
  // Drag state
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  
  // Resize state
  const [isResizing, setIsResizing] = useState(false)
  const [resizeEdge, setResizeEdge] = useState<string | null>(null)
  const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0, left: 0, top: 0 })
  
  // Popup content highlighting state
  const [popupConcepts, setPopupConcepts] = useState<ExtractedConcept[]>([])
  const [userHighlights, setUserHighlights] = useState<ExtractedConcept[]>([])
  const [isExtracting, setIsExtracting] = useState(false)
  const [extractionError, setExtractionError] = useState<string | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  
  // Combined text from explanation (used for concept extraction and highlighting)
  const combinedText = explanation ? `${explanation.summary}\n\n${explanation.context}` : ''
  const summaryLength = explanation?.summary.length || 0

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
    // Only drag from header, not from buttons or draggable elements (like stash handle)
    if ((e.target as HTMLElement).closest('button') ||
        (e.target as HTMLElement).closest('[draggable="true"]')) return
    
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

  // Handle related concept click
  const handleRelatedClick = useCallback(
    (name: string) => {
      if (onRelatedConceptClick) {
        onRelatedConceptClick(name)
      }
    },
    [onRelatedConceptClick]
  )

  // Calculate stacked position for minimized popup (lower-right corner)
  const getMinimizedPosition = useCallback((): PopupPosition => {
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const x = viewportWidth - STACK_RIGHT_OFFSET - MINIMIZED_WIDTH
    const y = viewportHeight - STACK_BOTTOM_OFFSET - MINIMIZED_ESTIMATED_HEIGHT - 
              (minimizedStackIndex * (MINIMIZED_ESTIMATED_HEIGHT + STACK_MARGIN))
    return { x, y }
  }, [minimizedStackIndex])

  // Handle minimize toggle
  const handleMinimizeToggle = useCallback(() => {
    if (isMinimized) {
      // Restore previous position and size
      if (preMinimizePosition) {
        setPopupPosition(preMinimizePosition)
      }
      setPopupSize({ width: preMinimizeWidth, height: preMinimizeHeight })
      setIsMinimized(false)
      onMinimizeChange?.(concept?.id || '', false)
    } else {
      // Save current position and size before minimizing
      setPreMinimizePosition(popupPosition)
      setPreMinimizeWidth(popupSize.width)
      setPreMinimizeHeight(popupSize.height)
      // Move to stacked position in lower-right
      setPopupPosition(getMinimizedPosition())
      setPopupSize({ width: MINIMIZED_WIDTH, height: MINIMIZED_ESTIMATED_HEIGHT })
      setIsMinimized(true)
      onMinimizeChange?.(concept?.id || '', true)
    }
  }, [isMinimized, preMinimizePosition, preMinimizeWidth, preMinimizeHeight, popupPosition, popupSize, getMinimizedPosition, onMinimizeChange, concept?.id])

  // Update minimized position when stack index changes
  useEffect(() => {
    if (isMinimized) {
      setPopupPosition(getMinimizedPosition())
    }
  }, [isMinimized, minimizedStackIndex, getMinimizedPosition])

  /**
   * Extracts concepts from the popup content (summary + context).
   * Called when user clicks the "✦" button.
   */
  const handleExtractConcepts = useCallback(async () => {
    if (!explanation || isExtracting) return
    
    setIsExtracting(true)
    setExtractionError(null)
    
    try {
      // Extract from combined text
      const extracted = await extractConcepts(combinedText)
      
      // Adjust indices: concepts in context section need offset by summary length + 2 (for \n\n)
      const adjustedConcepts = extracted.map(c => {
        // Check if concept is in the context section (after summary)
        if (c.startIndex > summaryLength) {
          return {
            ...c,
            // Mark as being in context section for rendering
            id: `popup_${c.id}`,
          }
        }
        return {
          ...c,
          id: `popup_${c.id}`,
        }
      })
      
      setPopupConcepts(adjustedConcepts)
    } catch (err) {
      setExtractionError(err instanceof Error ? err.message : 'Failed to extract concepts')
    } finally {
      setIsExtracting(false)
    }
  }, [explanation, isExtracting, combinedText, summaryLength])

  /**
   * Handles clicking on a concept within the popup content.
   * Opens a new popup for that concept.
   */
  const handlePopupConceptClick = useCallback((clickedConcept: ExtractedConcept, _event: React.MouseEvent) => {
    // Use the related concept click handler to open a new popup
    if (onRelatedConceptClick) {
      onRelatedConceptClick(clickedConcept.normalizedName)
    }
  }, [onRelatedConceptClick])

  /**
   * Handles text selection within the popup content for manual highlights.
   */
  const handleContentMouseUp = useCallback(() => {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed || !contentRef.current) {
      return
    }

    const selectedText = selection.toString().trim()
    if (!selectedText || selectedText.length < 2) {
      return
    }

    // Check if selection is within our content area
    const range = selection.getRangeAt(0)
    if (!contentRef.current.contains(range.commonAncestorContainer)) {
      return
    }

    // Find the position in the combined text
    const startIndex = combinedText.indexOf(selectedText)
    if (startIndex === -1) {
      return
    }

    const endIndex = startIndex + selectedText.length
    
    // Check for overlap with existing concepts
    const allConcepts = [...popupConcepts, ...userHighlights]
    const overlapsExisting = allConcepts.some(
      c => (startIndex < c.endIndex && endIndex > c.startIndex)
    )
    if (overlapsExisting) {
      return
    }

    // Create new user highlight
    const newHighlight: ExtractedConcept = {
      id: `user_popup_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      text: selectedText,
      normalizedName: selectedText.toLowerCase(),
      category: 'abstract' as ConceptCategory,
      startIndex,
      endIndex,
    }
    
    setUserHighlights(prev => [...prev, newHighlight])
    window.getSelection()?.removeAllRanges()
  }, [combinedText, popupConcepts, userHighlights])

  /**
   * Removes a user-created highlight from the popup.
   */
  const handleRemoveHighlight = useCallback((conceptId: string) => {
    setUserHighlights(prev => prev.filter(h => h.id !== conceptId))
    setPopupConcepts(prev => prev.filter(c => c.id !== conceptId))
  }, [])

  /**
   * Stashes the current explanation to the Stash and closes the popup.
   */
  const handleStashExplanation = useCallback(() => {
    if (!concept || !explanation) return
    
    addItem({
      type: 'explanation',
      content: concept.normalizedName,
      metadata: {
        summary: explanation.summary,
        context: explanation.context,
        relatedConcepts: explanation.relatedConcepts,
        conceptCategory: concept.category,
        normalizedName: concept.normalizedName,
      },
    })
    
    // Close the popup after stashing
    onClose()
  }, [concept, explanation, addItem, onClose])

  // Check if explanation is already stashed
  const isStashed = concept ? hasItem(concept.normalizedName, 'explanation') : false

  /**
   * Handles drag start for dragging popup to stash via the drag handle.
   */
  const handleStashDragStart = useCallback((e: React.DragEvent) => {
    if (!concept || !explanation) {
      e.preventDefault()
      return
    }
    
    const itemData = {
      type: 'explanation',
      content: concept.normalizedName,
      metadata: {
        summary: explanation.summary,
        context: explanation.context,
        relatedConcepts: explanation.relatedConcepts,
        conceptCategory: concept.category,
        normalizedName: concept.normalizedName,
      },
    }
    e.dataTransfer.setData('application/json', JSON.stringify(itemData))
    e.dataTransfer.effectAllowed = 'copy'
  }, [concept, explanation])

  /**
   * Handles drag end - closes popup if dropped successfully into stash.
   */
  const handleStashDragEnd = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.dropEffect !== 'none') {
      onClose()
    }
  }, [onClose])

  // Don't render if no concept
  if (!concept) return null

  const categoryLabel = categoryLabels[concept.category]

  return (
    <div
      ref={popupRef}
      className={`${styles.popup} ${isDragging ? styles.dragging : ''} ${isResizing ? styles.resizing : ''} ${isMinimized ? styles.minimized : ''}`}
      style={{
        left: popupPosition.x,
        top: popupPosition.y,
        width: popupSize.width,
        height: isMinimized ? 'auto' : popupSize.height,
      }}
      role="dialog"
      aria-label={`Concept explanation: ${concept.normalizedName}`}
      aria-live="polite"
    >
      {/* Resize handles - only show when not minimized */}
      {!isMinimized && (
        <>
          <div className={`${styles.resizeHandle} ${styles.resizeN}`} onMouseDown={(e) => handleResizeStart(e, 'n')} />
          <div className={`${styles.resizeHandle} ${styles.resizeS}`} onMouseDown={(e) => handleResizeStart(e, 's')} />
          <div className={`${styles.resizeHandle} ${styles.resizeE}`} onMouseDown={(e) => handleResizeStart(e, 'e')} />
          <div className={`${styles.resizeHandle} ${styles.resizeW}`} onMouseDown={(e) => handleResizeStart(e, 'w')} />
          <div className={`${styles.resizeHandle} ${styles.resizeNE}`} onMouseDown={(e) => handleResizeStart(e, 'ne')} />
          <div className={`${styles.resizeHandle} ${styles.resizeNW}`} onMouseDown={(e) => handleResizeStart(e, 'nw')} />
          <div className={`${styles.resizeHandle} ${styles.resizeSE}`} onMouseDown={(e) => handleResizeStart(e, 'se')} />
          <div className={`${styles.resizeHandle} ${styles.resizeSW}`} onMouseDown={(e) => handleResizeStart(e, 'sw')} />
        </>
      )}
      
      {/* Header - draggable area */}
      <div 
        ref={headerRef}
        className={`${styles.header} ${styles.draggableHeader}`}
        onMouseDown={handleDragStart}
      >
        {/* Drag handle for stashing - only visible when explanation is loaded */}
        {explanation && !isMinimized && (
          <div
            className={styles.stashDragHandle}
            draggable
            onDragStart={handleStashDragStart}
            onDragEnd={handleStashDragEnd}
            title="Drag to stash"
            aria-label="Drag to stash"
          >
            ⋮⋮
          </div>
        )}
        <div className={styles.titleRow}>
          <span className={styles.conceptName}>{concept.normalizedName}</span>
          <span className={`${styles.category} ${styles[`category${concept.category.charAt(0).toUpperCase() + concept.category.slice(1)}`]}`}>
            {categoryLabel}
          </span>
        </div>
        <div className={styles.actions}>
          {!isMinimized && explanation && (
            <>
              <StashButton
                onClick={handleStashExplanation}
                isStashed={isStashed}
                size="small"
                className={styles.stashButton}
              />
              <button
                className={`${styles.extractButton} ${isExtracting ? styles.extracting : ''} ${popupConcepts.length > 0 ? styles.extracted : ''}`}
                onClick={handleExtractConcepts}
                aria-label="Extract concepts from content"
                title={popupConcepts.length > 0 ? "Concepts extracted" : "Extract concepts"}
                disabled={isExtracting}
              >
                ✦
              </button>
            </>
          )}
          <button
            className={styles.minimizeButton}
            onClick={handleMinimizeToggle}
            aria-label={isMinimized ? "Expand popup" : "Minimize popup"}
            title={isMinimized ? "Expand" : "Minimize"}
          >
            {isMinimized ? '□' : '−'}
          </button>
          <button
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close popup"
          >
            ×
          </button>
        </div>
      </div>

      {/* Content - hidden when minimized */}
      {!isMinimized && (
      <div 
        ref={contentRef}
        className={styles.content}
        onMouseUp={handleContentMouseUp}
      >
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
        
        {extractionError && (
          <div className={styles.error}>
            <span className={styles.errorIcon}>!</span>
            <span>{extractionError}</span>
          </div>
        )}

        {explanation && !isLoading && !error && (
          <>
            {/* Summary */}
            <div className={styles.section}>
              {(() => {
                // Get concepts that apply to the summary section
                const allHighlights = [...popupConcepts, ...userHighlights]
                const summaryConcepts = allHighlights.filter(
                  c => c.startIndex >= 0 && c.endIndex <= summaryLength
                )
                
                if (summaryConcepts.length > 0) {
                  return (
                    <div className={styles.summary}>
                      <ConceptHighlighter
                        text={explanation.summary}
                        concepts={summaryConcepts}
                        onConceptClick={handlePopupConceptClick}
                        onConceptRemove={handleRemoveHighlight}
                      />
                    </div>
                  )
                }
                return <p className={styles.summary}>{explanation.summary}</p>
              })()}
            </div>

            {/* Context */}
            <div className={styles.section}>
              <h4 className={styles.sectionTitle}>In Context</h4>
              {(() => {
                // Get concepts that apply to the context section
                // Context starts after summary + "\n\n" (2 chars)
                const contextOffset = summaryLength + 2
                const allHighlights = [...popupConcepts, ...userHighlights]
                const contextConcepts = allHighlights
                  .filter(c => c.startIndex >= contextOffset)
                  .map(c => ({
                    ...c,
                    // Adjust indices to be relative to context text
                    startIndex: c.startIndex - contextOffset,
                    endIndex: c.endIndex - contextOffset,
                  }))
                
                if (contextConcepts.length > 0) {
                  return (
                    <div className={styles.context}>
                      <ConceptHighlighter
                        text={explanation.context}
                        concepts={contextConcepts}
                        onConceptClick={handlePopupConceptClick}
                        onConceptRemove={handleRemoveHighlight}
                      />
                    </div>
                  )
                }
                return <p className={styles.context}>{explanation.context}</p>
              })()}
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
      )}
    </div>
  )
}
