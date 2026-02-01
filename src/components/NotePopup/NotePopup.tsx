/**
 * @fileoverview Popup component for user-created notes on the canvas.
 * 
 * Similar to ConceptPopup but for editable user notes.
 * Features:
 * - Draggable and resizable
 * - Editable title and content
 * - Can be minimized, stashed, and closed
 * - Persists position and size during session
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import styles from './NotePopup.module.css'
import { useStashContext } from '../../context/StashContext'

/**
 * Position type for the popup.
 */
interface PopupPosition {
  x: number
  y: number
}

/**
 * Size type for the popup.
 */
interface PopupSize {
  width: number
  height: number
}

/**
 * Note data structure.
 */
export interface NoteData {
  id: string
  title: string
  content: string
  createdAt: number
}

/**
 * Props for NotePopup component.
 */
export interface NotePopupProps {
  /** Unique ID for this note */
  id: string
  
  /** Initial position */
  position: PopupPosition
  
  /** Called when popup should close */
  onClose: () => void
  
  /** Called when note content changes */
  onUpdate?: (id: string, title: string, content: string) => void
  
  /** Called when minimize state changes */
  onMinimizeChange?: (id: string, isMinimized: boolean) => void
  
  /** Stack index when minimized */
  minimizedStackIndex?: number
  
  /** Initial title */
  initialTitle?: string
  
  /** Initial content */
  initialContent?: string
}

// Default dimensions
const DEFAULT_WIDTH = 300
const DEFAULT_HEIGHT = 250
const MIN_WIDTH = 200
const MIN_HEIGHT = 150

// Minimized dimensions
const MINIMIZED_WIDTH = 200
const MINIMIZED_HEIGHT = 40
const STACK_RIGHT_OFFSET = 20
const STACK_BOTTOM_OFFSET = 20
const STACK_MARGIN = 8

/**
 * NotePopup - A draggable, resizable popup for user notes.
 */
export function NotePopup({
  id,
  position,
  onClose,
  onUpdate,
  onMinimizeChange,
  minimizedStackIndex = 0,
  initialTitle = '',
  initialContent = '',
}: NotePopupProps) {
  const popupRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)
  
  // Stash context
  const { addItem, hasItem } = useStashContext()
  
  // Note content state
  const [title, setTitle] = useState(initialTitle)
  const [content, setContent] = useState(initialContent)
  
  // Position and size state
  const [popupPosition, setPopupPosition] = useState(position)
  const [popupSize, setPopupSize] = useState<PopupSize>({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT })
  
  // Minimize state
  const [isMinimized, setIsMinimized] = useState(false)
  const [preMinimizeHeight, setPreMinimizeHeight] = useState(DEFAULT_HEIGHT)
  const [preMinimizePosition, setPreMinimizePosition] = useState<PopupPosition | null>(null)
  const [preMinimizeWidth, setPreMinimizeWidth] = useState(DEFAULT_WIDTH)
  
  // Drag state
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  
  // Resize state
  const [isResizing, setIsResizing] = useState(false)
  const [resizeEdge, setResizeEdge] = useState<string | null>(null)
  const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0, left: 0, top: 0 })
  
  // Focus title input on mount
  useEffect(() => {
    if (titleInputRef.current && !initialTitle) {
      titleInputRef.current.focus()
    }
  }, [initialTitle])
  
  // Notify parent of content changes
  useEffect(() => {
    onUpdate?.(id, title, content)
  }, [id, title, content, onUpdate])
  
  // Calculate minimized position
  const getMinimizedPosition = useCallback((): PopupPosition => {
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const x = viewportWidth - STACK_RIGHT_OFFSET - MINIMIZED_WIDTH
    const y = viewportHeight - STACK_BOTTOM_OFFSET - MINIMIZED_HEIGHT - 
              (minimizedStackIndex * (MINIMIZED_HEIGHT + STACK_MARGIN))
    return { x, y }
  }, [minimizedStackIndex])
  
  // Handle minimize toggle
  const handleMinimizeToggle = useCallback(() => {
    if (isMinimized) {
      if (preMinimizePosition) {
        setPopupPosition(preMinimizePosition)
      }
      setPopupSize({ width: preMinimizeWidth, height: preMinimizeHeight })
      setIsMinimized(false)
      onMinimizeChange?.(id, false)
    } else {
      setPreMinimizePosition(popupPosition)
      setPreMinimizeWidth(popupSize.width)
      setPreMinimizeHeight(popupSize.height)
      setPopupPosition(getMinimizedPosition())
      setPopupSize({ width: MINIMIZED_WIDTH, height: MINIMIZED_HEIGHT })
      setIsMinimized(true)
      onMinimizeChange?.(id, true)
    }
  }, [isMinimized, preMinimizePosition, preMinimizeWidth, preMinimizeHeight, popupPosition, popupSize, getMinimizedPosition, onMinimizeChange, id])
  
  // Update minimized position when stack index changes
  useEffect(() => {
    if (isMinimized) {
      setPopupPosition(getMinimizedPosition())
    }
  }, [isMinimized, minimizedStackIndex, getMinimizedPosition])
  
  // Handle stash
  const handleStash = useCallback(() => {
    if (!content.trim()) return
    
    addItem({
      type: 'note',
      content: content.trim(),
      metadata: {
        title: title.trim() || undefined,
      },
    })
  }, [addItem, title, content])
  
  // Check if already stashed
  const isStashed = hasItem(content.trim(), 'note')
  
  // Drag handlers
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (isResizing) return
    
    const rect = popupRef.current?.getBoundingClientRect()
    if (!rect) return
    
    setIsDragging(true)
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    })
  }, [isResizing])
  
  useEffect(() => {
    if (!isDragging) return
    
    const handleMouseMove = (e: MouseEvent) => {
      const x = Math.max(0, Math.min(window.innerWidth - popupSize.width, e.clientX - dragOffset.x))
      const y = Math.max(0, Math.min(window.innerHeight - 50, e.clientY - dragOffset.y))
      setPopupPosition({ x, y })
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
  
  // Resize handlers
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
  
  // Keyboard handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])
  
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
      aria-label="Note"
    >
      {/* Header */}
      <div
        ref={headerRef}
        className={styles.header}
        onMouseDown={handleDragStart}
      >
        <span className={styles.noteIcon}>📝</span>
        <span className={styles.headerLabel}>Note</span>
        
        <div className={styles.headerActions}>
          {/* Stash button */}
          <button
            className={styles.actionButton}
            onClick={handleStash}
            disabled={!content.trim() || isStashed}
            title={isStashed ? 'Already in Stash' : 'Add to Stash'}
            aria-label={isStashed ? 'Already in Stash' : 'Add to Stash'}
          >
            {isStashed ? '✓' : '☆'}
          </button>
          
          {/* Minimize button */}
          <button
            className={styles.actionButton}
            onClick={handleMinimizeToggle}
            title={isMinimized ? 'Expand' : 'Minimize'}
            aria-label={isMinimized ? 'Expand popup' : 'Minimize popup'}
          >
            {isMinimized ? '+' : '−'}
          </button>
          
          {/* Close button */}
          <button
            className={styles.closeButton}
            onClick={onClose}
            title="Close"
            aria-label="Close popup"
          >
            ×
          </button>
        </div>
      </div>
      
      {/* Content - hidden when minimized */}
      {!isMinimized && (
        <div className={styles.content}>
          <input
            ref={titleInputRef}
            type="text"
            className={styles.titleInput}
            placeholder="Note title..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            className={styles.contentInput}
            placeholder="Write your note here..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </div>
      )}
      
      {/* Resize handles - only when not minimized */}
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
    </div>
  )
}
