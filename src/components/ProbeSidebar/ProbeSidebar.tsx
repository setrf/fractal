/**
 * @fileoverview Collapsible right sidebar component for the Probe feature.
 *
 * Provides the main UI for synthesis-focused conversations.
 * Features:
 * - Collapsible panel with smooth animation
 * - Tab bar for multiple probes
 * - Active probe chat interface
 * - Drag-and-drop zone for adding stash items
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import styles from './ProbeSidebar.module.css'
import { useProbeContext } from '../../context/ProbeContext'
import { useIsMobile } from '../../hooks/useIsMobile'
import { ProbeTabBar } from '../ProbeTabBar'
import { ProbeChat } from '../ProbeChat'

/**
 * Props for ProbeSidebar component.
 */
export interface ProbeSidebarProps {
  /** Optional callback when a stash item is dragged over */
  onStashItemDrop?: (itemId: string) => void
}

/**
 * Collapsible right sidebar component for Probes.
 *
 * Shows probe tabs and the active probe's chat interface.
 * Can be collapsed to a thin strip with just the toggle button.
 *
 * @example
 * ```tsx
 * // In your app layout
 * <ProbeProvider>
 *   <div className="app-layout">
 *     <main>{children}</main>
 *     <ProbeSidebar />
 *   </div>
 * </ProbeProvider>
 * ```
 */
export function ProbeSidebar({ onStashItemDrop }: ProbeSidebarProps = {}) {
  const {
    probes,
    activeProbe,
    createProbe,
    isOpen,
    setIsOpen,
    toggleOpen,
    count,
    canCreateProbe,
    sidebarWidth,
    setSidebarWidth,
    externalDragHover,
    addStashItemToProbe,
  } = useProbeContext()

  const isMobile = useIsMobile()

  const [isDragOver, setIsDragOver] = useState(false)
  
  // Resize state
  const [isResizing, setIsResizing] = useState(false)
  const sidebarRef = useRef<HTMLElement>(null)
  const resizeStartX = useRef(0)
  const resizeStartWidth = useRef(0)

  // Min and max width constraints
  const MIN_WIDTH = 300
  const MAX_WIDTH = 700

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
      // For right sidebar, moving left increases width
      const delta = resizeStartX.current - e.clientX
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

  // Handle creating a new probe
  const handleCreateProbe = useCallback(() => {
    createProbe()
  }, [createProbe])

  // Check if this is an external drop (from stash) by checking data types
  const isExternalDrag = useCallback((e: React.DragEvent): boolean => {
    const types = Array.from(e.dataTransfer.types)
    return types.includes('application/json') || 
           types.includes('text/x-stash-item') ||
           types.includes('text/plain') ||
           types.includes('Files')
  }, [])

  // Drag and drop handlers for EXTERNAL drops (from stash)
  const handleDragOver = useCallback((e: React.DragEvent<HTMLElement>) => {
    // Only show drop zone for external drags (from stash)
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
      const sidebar = sidebarRef.current
      const relatedTarget = e.relatedTarget as Node | null
      if (sidebar && relatedTarget && !sidebar.contains(relatedTarget)) {
        setIsDragOver(false)
      } else if (!relatedTarget) {
        setIsDragOver(false)
      }
    }
  }, [isExternalDrag])

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLElement>) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(false)

      if (!activeProbe) return

      try {
        // Try to get stash item ID directly first (most reliable for internal drags)
        const itemId = e.dataTransfer.getData('text/x-stash-item')
        if (itemId) {
          addStashItemToProbe(activeProbe.id, itemId)
          onStashItemDrop?.(itemId)
          return
        }

        // Fallback to plain text if it's just an ID
        const plainData = e.dataTransfer.getData('text/plain')
        if (plainData && plainData.startsWith('s_')) { // Stash IDs usually start with s_
          addStashItemToProbe(activeProbe.id, plainData)
          onStashItemDrop?.(plainData)
          return
        }

        // Try to parse JSON data
        const jsonData = e.dataTransfer.getData('application/json')
        if (jsonData) {
          const parsed = JSON.parse(jsonData)
          if (parsed.id) {
            addStashItemToProbe(activeProbe.id, parsed.id)
            onStashItemDrop?.(parsed.id)
            return
          }
        }
      } catch (error) {
        console.error('[ProbeSidebar] Failed to parse dropped data:', error)
      }
    },
    [activeProbe, addStashItemToProbe, onStashItemDrop]
  )

  return (
    <aside
      ref={sidebarRef}
      className={`${styles.sidebar} ${isOpen ? styles.open : styles.collapsed} ${isResizing ? styles.resizing : ''}`}
      style={isOpen ? { width: sidebarWidth } : undefined}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      data-probe-sidebar="true"
      data-onboarding="probe-sidebar"
    >
      {/* Toggle button - always visible on desktop, hidden on mobile */}
      {!isMobile && (
        <button
          className={styles.toggleButton}
          onClick={toggleOpen}
          aria-label={isOpen ? 'Collapse probe' : 'Expand probe'}
          title={isOpen ? 'Collapse' : 'Open Probe'}
        >
          <span className={styles.toggleIcon} aria-hidden="true">
            {isOpen ? '▸' : '◂'}
          </span>
          {!isOpen && (
            <span className={styles.collapsedLabel}>
              <span className={styles.collapsedIcon}>⚡</span>
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
              <span className={styles.titleIcon}>⚡</span>
              Probe
              {count > 0 && <span className={styles.count}>({count})</span>}
            </h2>
            <div className={styles.headerActions}>
              <button
                className={styles.createButton}
                onClick={handleCreateProbe}
                disabled={!canCreateProbe}
                aria-label="Create new probe"
                title={canCreateProbe ? 'New Probe' : 'Max 5 probes reached'}
                data-onboarding="probe-create"
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

          {/* Tab bar - only show if there are probes */}
          {probes.length > 0 && <ProbeTabBar />}

          {/* Probe content */}
          <div className={styles.probeContent}>
            {probes.length === 0 ? (
              <div className={styles.emptyState}>
                <p className={styles.emptyText}>No probes yet</p>
                <p className={styles.emptyHint}>
                  Create a probe to synthesize your collected insights
                </p>
                <button
                  className={styles.createFirstButton}
                  onClick={handleCreateProbe}
                >
                  Create First Probe
                </button>
              </div>
            ) : activeProbe ? (
              <ProbeChat probe={activeProbe} />
            ) : (
              <div className={styles.emptyState}>
                <p className={styles.emptyText}>Select a probe</p>
                <p className={styles.emptyHint}>
                  Click a tab above to open a probe
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Drag overlay */}
      {(isDragOver || externalDragHover) && activeProbe && (
        <div className={styles.dragOverlay}>
          <span className={styles.dragText}>Add to {activeProbe.name}</span>
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
