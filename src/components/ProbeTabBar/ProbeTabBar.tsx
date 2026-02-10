/**
 * @fileoverview Tab bar component for navigating between Probes.
 *
 * Displays horizontal tabs with color indicators for each probe.
 * Supports:
 * - Tab switching
 * - Inline rename via double-click
 * - Delete via close button
 * - Context menu for additional actions
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import styles from './ProbeTabBar.module.css'
import { useProbeContext } from '../../context/ProbeContext'
import type { Probe } from '../../types/probe'

/**
 * Tab bar component for Probes.
 *
 * Shows all probes as tabs with color indicators.
 * Active probe is highlighted.
 */
export function ProbeTabBar() {
  const {
    probes,
    activeProbeId,
    setActiveProbeId,
    renameProbe,
    deleteProbe,
  } = useProbeContext()

  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [contextMenuId, setContextMenuId] = useState<string | null>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)

  // Focus rename input when entering rename mode
  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [renamingId])

  // Close context menu when clicking outside
  useEffect(() => {
    if (!contextMenuId) return

    const handleClickOutside = () => {
      setContextMenuId(null)
    }

    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [contextMenuId])

  // Handle tab click
  const handleTabClick = useCallback((probeId: string) => {
    if (renamingId === probeId) return // Don't switch if renaming
    setActiveProbeId(probeId)
  }, [renamingId, setActiveProbeId])

  // Keyboard interaction for tab activation/navigation
  const handleTabKeyDown = useCallback((e: React.KeyboardEvent, index: number) => {
    const probe = probes[index]

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleTabClick(probe.id)
      return
    }

    if (e.key === 'ArrowRight') {
      e.preventDefault()
      const nextProbe = probes[(index + 1) % probes.length]
      setActiveProbeId(nextProbe.id)
      return
    }

    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      const prevIndex = (index - 1 + probes.length) % probes.length
      const prevProbe = probes[prevIndex]
      setActiveProbeId(prevProbe.id)
    }
  }, [probes, handleTabClick, setActiveProbeId])

  // Handle double-click to rename
  const handleDoubleClick = useCallback((probe: Probe) => {
    setRenamingId(probe.id)
    setRenameValue(probe.name)
    setContextMenuId(null)
  }, [])

  // Handle rename submit
  const handleRenameSubmit = useCallback(() => {
    if (renamingId && renameValue.trim()) {
      renameProbe(renamingId, renameValue.trim())
    }
    setRenamingId(null)
    setRenameValue('')
  }, [renamingId, renameValue, renameProbe])

  // Handle rename key events
  const handleRenameKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRenameSubmit()
    } else if (e.key === 'Escape') {
      setRenamingId(null)
      setRenameValue('')
    }
  }, [handleRenameSubmit])

  // Handle context menu (right-click)
  const handleContextMenu = useCallback((e: React.MouseEvent, probeId: string) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenuId(probeId === contextMenuId ? null : probeId)
  }, [contextMenuId])

  // Handle delete
  const handleDelete = useCallback((probeId: string) => {
    deleteProbe(probeId)
    setContextMenuId(null)
  }, [deleteProbe])

  return (
    <div className={styles.tabBar}>
      {probes.map((probe, index) => (
        <div
          key={probe.id}
          className={`${styles.tab} ${activeProbeId === probe.id ? styles.active : ''}`}
          onClick={() => handleTabClick(probe.id)}
          onKeyDown={(e) => handleTabKeyDown(e, index)}
          onDoubleClick={() => handleDoubleClick(probe)}
          onContextMenu={(e) => handleContextMenu(e, probe.id)}
          role="tab"
          aria-selected={activeProbeId === probe.id}
          tabIndex={0}
        >
          {/* Color indicator */}
          <span className={`${styles.colorDot} ${styles[probe.color]}`} />

          {/* Tab name or rename input */}
          {renamingId === probe.id ? (
            <input
              ref={renameInputRef}
              className={styles.renameInput}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={handleRenameSubmit}
              onKeyDown={handleRenameKeyDown}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className={styles.tabName}>{probe.name}</span>
          )}

          {/* Delete button */}
          <button
            className={styles.tabDelete}
            onClick={(e) => {
              e.stopPropagation()
              handleDelete(probe.id)
            }}
            aria-label={`Delete ${probe.name}`}
            title="Delete probe"
          >
            ×
          </button>

          {/* Context menu */}
          {contextMenuId === probe.id && (
            <div className={styles.contextMenu} onClick={(e) => e.stopPropagation()}>
              <button
                className={styles.contextMenuItem}
                onClick={() => handleDoubleClick(probe)}
              >
                Rename
              </button>
              <button
                className={`${styles.contextMenuItem} ${styles.danger}`}
                onClick={() => handleDelete(probe.id)}
              >
                Delete
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
