/**
 * @fileoverview Collapsible sidebar component for the Stash feature.
 *
 * Provides the main UI for viewing, filtering, and managing stashed items.
 * Features:
 * - Collapsible panel with smooth animation
 * - Filter tabs by content type
 * - Search functionality
 * - Export/clear actions
 * - Drag-and-drop zone for adding items
 */

import { useState, useCallback, useRef, useEffect, type DragEvent } from 'react'
import styles from './StashSidebar.module.css'
import { StashItem } from '../StashItem'
import { useStashContext } from '../../context/StashContext'
import type { StashItemType, StashItemInput, StashItem as StashItemData } from '../../types/stash'
import { stashTypeLabels, stashTypeIcons } from '../../types/stash'

/**
 * Props for StashSidebar component.
 */
export interface StashSidebarProps {
  /** Called when a stash item is clicked (to reopen as popup) */
  onItemClick?: (item: StashItemData) => void
}

/**
 * Filter options for the stash.
 * null = show all items
 */
const FILTER_OPTIONS: (StashItemType | null)[] = [
  null,           // All
  'highlight',
  'question',
  'explanation',
  'chat-message',
  'note',
]

/**
 * Collapsible sidebar component for the Stash.
 *
 * Shows all stashed items with filtering, search, and management options.
 * Can be collapsed to a thin strip with just the toggle button.
 *
 * @example
 * ```tsx
 * // In your app layout
 * <StashProvider>
 *   <div className="app-layout">
 *     <StashSidebar />
 *     <main>{children}</main>
 *   </div>
 * </StashProvider>
 * ```
 */
export function StashSidebar({ onItemClick }: StashSidebarProps = {}) {
  const {
    items,
    removeItem,
    clearAll,
    exportToJSON,
    isOpen,
    toggleOpen,
    filterType,
    setFilterType,
    searchQuery,
    setSearchQuery,
    count,
    addItem,
    reorderItem,
  } = useStashContext()

  const [isDragOver, setIsDragOver] = useState(false)
  const [isAddingNote, setIsAddingNote] = useState(false)
  const [noteTitle, setNoteTitle] = useState('')
  const [noteContent, setNoteContent] = useState('')
  
  // Drag-to-reorder state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null)
  
  // Resize state
  const [sidebarWidth, setSidebarWidth] = useState(320)
  const [isResizing, setIsResizing] = useState(false)
  const sidebarRef = useRef<HTMLElement>(null)
  const resizeStartX = useRef(0)
  const resizeStartWidth = useRef(0)

  // Min and max width constraints
  const MIN_WIDTH = 200
  const MAX_WIDTH = 600

  // Handle resize start
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
    resizeStartX.current = e.clientX
    resizeStartWidth.current = sidebarWidth
  }, [sidebarWidth])

  // Handle resize move and end via useEffect
  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - resizeStartX.current
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, resizeStartWidth.current + delta))
      setSidebarWidth(newWidth)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing])

  // Handle creating a new note
  const handleCreateNote = useCallback(() => {
    const trimmedContent = noteContent.trim()
    if (!trimmedContent) return

    addItem({
      type: 'note',
      content: trimmedContent,
      metadata: {
        title: noteTitle.trim() || undefined,
      },
    })

    // Reset form
    setNoteTitle('')
    setNoteContent('')
    setIsAddingNote(false)
  }, [addItem, noteContent, noteTitle])

  // Handle cancel note creation
  const handleCancelNote = useCallback(() => {
    setNoteTitle('')
    setNoteContent('')
    setIsAddingNote(false)
  }, [])

  // Handle filter tab click
  const handleFilterClick = useCallback(
    (type: StashItemType | null) => {
      setFilterType(type)
    },
    [setFilterType]
  )

  // Handle search input
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchQuery(e.target.value)
    },
    [setSearchQuery]
  )

  // Handle export button
  const handleExport = useCallback(() => {
    const json = exportToJSON()
    // Create download link
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `fractal-stash-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [exportToJSON])

  // Handle clear all with confirmation
  const handleClearAll = useCallback(() => {
    if (window.confirm('Are you sure you want to clear all stashed items? This cannot be undone.')) {
      clearAll()
    }
  }, [clearAll])

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent<HTMLElement>) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLElement>) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLElement>) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(false)

      try {
        const data = e.dataTransfer.getData('application/json')
        console.log('[StashSidebar] Drop received, data:', data)
        if (data) {
          const item = JSON.parse(data) as StashItemInput
          console.log('[StashSidebar] Parsed item:', item)
          addItem(item)
        }
      } catch (error) {
        console.error('[StashSidebar] Failed to parse dropped data:', error)
      }
    },
    [addItem]
  )

  // Item reorder handlers
  const handleItemDragStart = useCallback((index: number) => {
    setDraggedIndex(index)
  }, [])

  const handleItemDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault()
    e.stopPropagation()
    if (draggedIndex !== null && draggedIndex !== index) {
      setDropTargetIndex(index)
    }
  }, [draggedIndex])

  const handleItemDragLeave = useCallback(() => {
    setDropTargetIndex(null)
  }, [])

  const handleItemDrop = useCallback((e: React.DragEvent, toIndex: number) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (draggedIndex !== null && draggedIndex !== toIndex) {
      reorderItem(draggedIndex, toIndex)
    }
    
    setDraggedIndex(null)
    setDropTargetIndex(null)
  }, [draggedIndex, reorderItem])

  const handleItemDragEnd = useCallback(() => {
    setDraggedIndex(null)
    setDropTargetIndex(null)
  }, [])

  // Get filter label
  const getFilterLabel = (type: StashItemType | null): string => {
    if (type === null) return 'All'
    return stashTypeLabels[type]
  }

  // Get filter icon
  const getFilterIcon = (type: StashItemType | null): string => {
    if (type === null) return '◉'
    return stashTypeIcons[type]
  }

  return (
    <aside
      ref={sidebarRef}
      className={`${styles.sidebar} ${isOpen ? styles.open : styles.collapsed} ${isResizing ? styles.resizing : ''}`}
      style={isOpen ? { width: sidebarWidth } : undefined}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Toggle button - always visible */}
      <button
        className={styles.toggleButton}
        onClick={toggleOpen}
        aria-label={isOpen ? 'Collapse stash' : 'Expand stash'}
        title={isOpen ? 'Collapse' : 'Open Stash'}
      >
        <span className={styles.toggleIcon} aria-hidden="true">
          {isOpen ? '◂' : '▸'}
        </span>
        {!isOpen && (
          <span className={styles.collapsedLabel}>
            <span className={styles.collapsedIcon}>☆</span>
            {count > 0 && (
              <span className={styles.collapsedCount}>{count}</span>
            )}
          </span>
        )}
      </button>

      {/* Main content - only visible when open */}
      {isOpen && (
        <div className={styles.content}>
          {/* Header */}
          <header className={styles.header}>
            <h2 className={styles.title}>
              <span className={styles.titleIcon}>☆</span>
              Stash
              <span className={styles.count}>({count})</span>
            </h2>
            <button
              className={styles.addNoteButton}
              onClick={() => setIsAddingNote(true)}
              aria-label="Add a note"
              title="Add Note"
            >
              +
            </button>
          </header>

          {/* Note creation form */}
          {isAddingNote && (
            <div className={styles.noteForm}>
              <input
                type="text"
                className={styles.noteTitleInput}
                placeholder="Note title (optional)"
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                autoFocus
              />
              <textarea
                className={styles.noteContentInput}
                placeholder="Write your note..."
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                rows={3}
              />
              <div className={styles.noteActions}>
                <button
                  className={styles.noteSaveButton}
                  onClick={handleCreateNote}
                  disabled={!noteContent.trim()}
                >
                  Save
                </button>
                <button
                  className={styles.noteCancelButton}
                  onClick={handleCancelNote}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Search */}
          <div className={styles.search}>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search stash..."
              value={searchQuery}
              onChange={handleSearchChange}
              aria-label="Search stash"
            />
          </div>

          {/* Filter tabs */}
          <div className={styles.filters}>
            {FILTER_OPTIONS.map((type) => (
              <button
                key={type ?? 'all'}
                className={`${styles.filterTab} ${filterType === type ? styles.active : ''}`}
                onClick={() => handleFilterClick(type)}
                aria-pressed={filterType === type}
                title={getFilterLabel(type)}
              >
                <span className={styles.filterIcon}>{getFilterIcon(type)}</span>
              </button>
            ))}
          </div>

          {/* Items list */}
          <div
            className={`${styles.itemsList} ${isDragOver ? styles.dragOver : ''}`}
          >
            {items.length === 0 ? (
              <div className={styles.emptyState}>
                <p className={styles.emptyText}>
                  {searchQuery || filterType
                    ? 'No matching items'
                    : 'Your stash is empty'}
                </p>
                <p className={styles.emptyHint}>
                  {searchQuery || filterType
                    ? 'Try a different search or filter'
                    : 'Click ☆ on items to add them here'}
                </p>
              </div>
            ) : (
              items.map((item, index) => (
                <div
                  key={item.id}
                  className={`${styles.itemWrapper} ${
                    draggedIndex === index ? styles.dragging : ''
                  } ${dropTargetIndex === index ? styles.dropTarget : ''}`}
                  draggable
                  onDragStart={() => handleItemDragStart(index)}
                  onDragOver={(e) => handleItemDragOver(e, index)}
                  onDragLeave={handleItemDragLeave}
                  onDrop={(e) => handleItemDrop(e, index)}
                  onDragEnd={handleItemDragEnd}
                >
                  <StashItem
                    item={item}
                    onDelete={removeItem}
                    onClick={onItemClick}
                    draggable={false}
                  />
                </div>
              ))
            )}
          </div>

          {/* Footer actions */}
          <footer className={styles.footer}>
            <button
              className={styles.footerButton}
              onClick={handleExport}
              disabled={count === 0}
              title="Export as JSON"
            >
              ↓ Export
            </button>
            <button
              className={`${styles.footerButton} ${styles.danger}`}
              onClick={handleClearAll}
              disabled={count === 0}
              title="Clear all items"
            >
              ✕ Clear
            </button>
          </footer>
        </div>
      )}

      {/* Drag overlay */}
      {isDragOver && (
        <div className={styles.dragOverlay}>
          <span className={styles.dragText}>Drop to stash</span>
        </div>
      )}

      {/* Resize handle - only visible when open */}
      {isOpen && (
        <div
          className={styles.resizeHandle}
          onMouseDown={handleResizeStart}
          aria-label="Resize sidebar"
          role="separator"
          aria-orientation="vertical"
        />
      )}
    </aside>
  )
}
