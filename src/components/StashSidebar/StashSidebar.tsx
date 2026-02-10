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

import { useState, useCallback, useRef, useEffect } from 'react'
import styles from './StashSidebar.module.css'
import { StashItem } from '../StashItem'
import { useStashContext } from '../../context/StashContext'
import { useProbeContext } from '../../context/ProbeContext'
import { useIsMobile } from '../../hooks/useIsMobile'
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
    items: allItems,
    displayedItems,
    removeItem,
    clearAll,
    exportToJSON,
    isOpen,
    setIsOpen,
    toggleOpen,
    filterType,
    setFilterType,
    searchQuery,
    setSearchQuery,
    count,
    addItem,
    reorderItem,
    externalDragHover,
    sidebarWidth,
    setSidebarWidth,
  } = useStashContext()

  const { setExternalDragHover: setProbeExternalDragHover } = useProbeContext()

  const isMobile = useIsMobile()

  const [isDragOver, setIsDragOver] = useState(false)
  const [isAddingNote, setIsAddingNote] = useState(false)
  const [noteTitle, setNoteTitle] = useState('')
  const [noteContent, setNoteContent] = useState('')

  // Drag-to-reorder state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null)
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null)

  // Resize state
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
  }, [isResizing, setSidebarWidth])

  // Handle creating a new note
  const handleCreateNote = useCallback(() => {
    const trimmedContent = noteContent.trim()

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

  // Handle clear all
  const handleClearAll = useCallback(() => {
    clearAll()
  }, [clearAll])

  // Check if this is an external drop (from popup) by checking data types
  const isExternalDrag = useCallback((e: React.DragEvent): boolean => {
    const types = Array.from(e.dataTransfer.types)
    return types.includes('application/json') && !types.includes('text/x-stash-reorder')
  }, [])

  // Drag and drop handlers for EXTERNAL drops (from popups)
  const handleDragOver = useCallback((e: React.DragEvent<HTMLElement>) => {
    // Only show drop zone for external drags (from popups)
    if (isExternalDrag(e)) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
      setIsDragOver(true)
    }
  }, [isExternalDrag])

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLElement>) => {
    // Only handle for external drags
    if (isExternalDrag(e)) {
      e.preventDefault()
      // Only set isDragOver to false if we're actually leaving the sidebar
      // (not just moving between child elements)
      const sidebar = sidebarRef.current
      const relatedTarget = e.relatedTarget as Node | null
      if (sidebar && relatedTarget && !sidebar.contains(relatedTarget)) {
        setIsDragOver(false)
      } else if (!relatedTarget) {
        // relatedTarget is null when leaving the window
        setIsDragOver(false)
      }
    }
  }, [isExternalDrag])

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLElement>) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(false)

      try {
        const data = e.dataTransfer.getData('application/json')
        if (data) {
          const item = JSON.parse(data) as StashItemInput
          addItem(item)
        }
      } catch (error) {
        console.error('[StashSidebar] Failed to parse dropped data:', error)
      }
    },
    [addItem]
  )

  // Item reorder handlers for INTERNAL reordering and removal
  // Also supports dragging to Probe sidebar
  const handleItemDragStart = useCallback((e: React.DragEvent, index: number, itemId: string) => {
    // Set a custom type to identify internal reorder drags
    e.dataTransfer.setData('text/x-stash-reorder', String(index))
    // Also set the stash item ID for probe sidebar drops
    e.dataTransfer.setData('text/x-stash-item', itemId)
    e.dataTransfer.setData('text/plain', itemId)
    e.dataTransfer.setData('application/json', JSON.stringify({ id: itemId }))
    e.dataTransfer.effectAllowed = 'copyMove'
    setDraggedIndex(index)
    setDraggedItemId(itemId)
    
    // Light up the probe sidebar
    setProbeExternalDragHover(true)
  }, [setProbeExternalDragHover])

  const handleItemDragOver = useCallback((e: React.DragEvent, index: number) => {
    // Check if this is an internal reorder drag
    const types = Array.from(e.dataTransfer.types)
    const isInternalDrag = types.includes('text/x-stash-reorder')

    if (isInternalDrag) {
      e.preventDefault()
      e.stopPropagation()
      if (draggedIndex !== null && draggedIndex !== index) {
        setDropTargetIndex(index)
      }
    } else {
      // For external drags, still need to call preventDefault to allow drop
      // but let the event bubble up for the sidebar to handle
      e.preventDefault()
    }
  }, [draggedIndex])

  const handleItemDragLeave = useCallback(() => {
    setDropTargetIndex(null)
  }, [])

  const handleItemDrop = useCallback((e: React.DragEvent, toIndex: number) => {
    // Check if this is an internal reorder drag
    const types = Array.from(e.dataTransfer.types)
    const isInternalDrag = types.includes('text/x-stash-reorder')

    if (isInternalDrag && draggedItemId && draggedIndex !== null && draggedIndex !== toIndex) {
      e.preventDefault()
      e.stopPropagation()
      const toItem = displayedItems[toIndex]!

      const fromIndex = allItems.findIndex(item => item.id === draggedItemId)
      const toIndexFull = allItems.findIndex(item => item.id === toItem.id)
      if (fromIndex === -1 || toIndexFull === -1) return

      reorderItem(fromIndex, toIndexFull)
      setDraggedIndex(null)
      setDropTargetIndex(null)
    }
    // For external drags, don't stop propagation - let it bubble up to sidebar's handleDrop
  }, [allItems, displayedItems, draggedIndex, draggedItemId, reorderItem])

  const handleItemDragEnd = useCallback((e: React.DragEvent) => {
    // Stop lighting up the probe sidebar
    setProbeExternalDragHover(false)

    // Check if dropped outside the sidebar - if so, remove the item
    const sidebar = sidebarRef.current
    if (sidebar && draggedItemId) {
      const rect = sidebar.getBoundingClientRect()
      const isOutside = e.clientX < rect.left || e.clientX > rect.right ||
        e.clientY < rect.top || e.clientY > rect.bottom

      const probeSidebar = document.querySelector('[data-probe-sidebar="true"]') as HTMLElement | null
      const probeRect = probeSidebar?.getBoundingClientRect()
      const isOverProbe = !!probeRect &&
        e.clientX >= probeRect.left && e.clientX <= probeRect.right &&
        e.clientY >= probeRect.top && e.clientY <= probeRect.bottom

      if (isOutside && !isOverProbe) {
        // Dropped outside - remove the item
        removeItem(draggedItemId)
      }
    }

    setDraggedIndex(null)
    setDraggedItemId(null)
    setDropTargetIndex(null)
  }, [draggedItemId, removeItem, setProbeExternalDragHover])

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
      data-stash-sidebar="true"
      data-onboarding="stash-sidebar"
    >
      {/* Toggle button - always visible on desktop, hidden on mobile */}
      {!isMobile && (
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
      )}

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
            <div className={styles.headerActions}>
              <button
                className={styles.addNoteButton}
                onClick={() => setIsAddingNote(true)}
                aria-label="Add a note"
                title="Add Note"
              >
                +
              </button>
              {isMobile && (
                <button
                  className={styles.closeSidebarButton}
                  onClick={() => setIsOpen(false)}
                  aria-label="Close sidebar"
                  title="Close"
                >
                  ×
                </button>
              )}
            </div>
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
            className={`${styles.itemsList} ${isDragOver || externalDragHover ? styles.dragOver : ''}`}
          >
            {displayedItems.length === 0 ? (
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
              displayedItems.map((item, index) => (
                <div
                  key={item.id}
                  className={`${styles.itemWrapper} ${draggedIndex === index ? styles.dragging : ''
                    } ${dropTargetIndex === index ? styles.dropTarget : ''}`}
                  draggable
                  onDragStart={(e) => handleItemDragStart(e, index, item.id)}
                  onDragOver={(e) => handleItemDragOver(e, index)}
                  onDragLeave={handleItemDragLeave}
                  onDrop={(e) => handleItemDrop(e, index)}
                  onDragEnd={(e) => handleItemDragEnd(e)}
                  data-onboarding={index === 0 ? 'stash-item' : undefined}
                >
                  <StashItem
                    item={item}
                    onDelete={removeItem}
                    onClick={onItemClick}
                    draggable={false}
                    checkboxOnboardingId={index === 0 ? 'stash-checkbox' : undefined}
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
      {(isDragOver || externalDragHover) && (
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
