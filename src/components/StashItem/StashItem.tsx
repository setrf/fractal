/**
 * @fileoverview Component for rendering individual items in the Stash.
 *
 * Displays a stashed item with:
 * - Type indicator (icon + color accent)
 * - Content preview (truncated, expandable)
 * - Metadata (timestamp, source context)
 * - Delete button
 * - Drag handle for reordering
 * - Probe selection checkbox (when probe sidebar is open)
 * - Probe assignment badges
 */

import { useState, useCallback, type MouseEvent } from 'react'
import styles from './StashItem.module.css'
import type { StashItem as StashItemType, StashItemType as ItemType } from '../../types/stash'
import { stashTypeIcons, stashTypeLabels } from '../../types/stash'
import { useProbeContext } from '../../context/ProbeContext'

/**
 * Props for the StashItem component.
 */
export interface StashItemProps {
  /** The stash item to render */
  item: StashItemType

  /** Callback when the delete button is clicked */
  onDelete: (id: string) => void

  /** Callback when the item is clicked (optional, for expansion) */
  onClick?: (item: StashItemType) => void

  /** Whether the item is draggable */
  draggable?: boolean

  /** Drag start handler for reordering */
  onDragStart?: (e: React.DragEvent, item: StashItemType) => void

  /** Optional onboarding anchor for probe selection checkbox */
  checkboxOnboardingId?: string
}

/**
 * Formats a timestamp as a relative or absolute date string.
 */
const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Gets the CSS class for the item type.
 */
const getTypeClass = (type: ItemType): string => {
  const classMap: Record<ItemType, string> = {
    highlight: styles.highlight,
    explanation: styles.explanation,
    question: styles.question,
    'chat-message': styles.chat,
    note: styles.note,
  }
  return classMap[type] || ''
}

/**
 * Truncates content to a maximum length.
 */
const truncate = (text: string, maxLength: number = 120): string => {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength).trim() + '...'
}

/**
 * Component for rendering a single stash item.
 *
 * Shows a preview of the stashed content with type indicator,
 * timestamp, and delete functionality.
 * 
 * When the Probe sidebar is open, shows a checkbox for selecting
 * items to include in the active probe's context.
 *
 * @example
 * ```tsx
 * <StashItem
 *   item={stashItem}
 *   onDelete={(id) => removeItem(id)}
 * />
 * ```
 */
export function StashItem({
  item,
  onDelete,
  onClick,
  draggable = false,
  onDragStart,
  checkboxOnboardingId,
}: StashItemProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  
  // Probe context for selection functionality
  const {
    isOpen: isProbeOpen,
    activeProbeId,
    toggleStashItemForProbe,
    isStashItemSelectedForProbe,
    getProbesForStashItem,
  } = useProbeContext()
  
  // Get probes that have this item selected
  const assignedProbes = getProbesForStashItem(item.id)
  const isSelectedForActiveProbe = activeProbeId 
    ? isStashItemSelectedForProbe(activeProbeId, item.id) 
    : false

  const handleClick = useCallback(() => {
    setIsExpanded(prev => !prev)
    onClick?.(item)
  }, [item, onClick])
  
  // Handle checkbox click for probe selection
  const handleCheckboxClick = useCallback((e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    toggleStashItemForProbe(activeProbeId as string, item.id)
  }, [activeProbeId, item.id, toggleStashItemForProbe])

  const handleDelete = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation()
      onDelete(item.id)
    },
    [item.id, onDelete]
  )

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      if (onDragStart) {
        onDragStart(e, item)
      }
    },
    [item, onDragStart]
  )

  // Get display content based on type
  const getDisplayContent = (): string => {
    switch (item.type) {
      case 'explanation':
        return item.metadata.summary || item.content
      case 'note':
        return item.metadata.title || item.content
      default:
        return item.content
    }
  }

  // Get secondary info based on type
  const getSecondaryInfo = (): string | null => {
    switch (item.type) {
      case 'highlight':
        return item.metadata.sourceQuestion
          ? `from: ${truncate(item.metadata.sourceQuestion, 50)}`
          : null
      case 'explanation':
        return item.metadata.context
          ? truncate(item.metadata.context, 80)
          : null
      case 'question':
        return item.metadata.parentQuestion
          ? `parent: ${truncate(item.metadata.parentQuestion, 50)}`
          : null
      case 'chat-message':
        return item.metadata.role
          ? `${item.metadata.role === 'assistant' ? 'AI' : 'You'}`
          : null
      case 'note':
        return item.metadata.linkedItemId
          ? 'linked note'
          : null
      default:
        return null
    }
  }

  const displayContent = getDisplayContent()
  const secondaryInfo = getSecondaryInfo()
  const typeClass = getTypeClass(item.type)
  
  // Show checkbox when probe sidebar is open
  const showCheckbox = isProbeOpen && activeProbeId

  return (
    <div
      className={`${styles.item} ${typeClass} ${isExpanded ? styles.expanded : ''} ${showCheckbox ? styles.hasCheckbox : ''} ${assignedProbes.length > 0 ? styles.hasProbes : ''}`}
      onClick={handleClick}
      draggable={draggable}
      onDragStart={handleDragStart}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleClick()
        }
      }}
    >
      {/* Checkbox for probe selection */}
      {showCheckbox && (
        <button
          className={`${styles.checkbox} ${isSelectedForActiveProbe ? styles.checked : ''}`}
          onClick={handleCheckboxClick}
          aria-label={isSelectedForActiveProbe ? 'Remove from probe' : 'Add to probe'}
          title={isSelectedForActiveProbe ? 'Remove from probe context' : 'Add to probe context'}
          data-onboarding={checkboxOnboardingId}
        >
          {isSelectedForActiveProbe && <span className={styles.checkmark}>✓</span>}
        </button>
      )}
      
      {/* Probe assignment badges */}
      {assignedProbes.length > 0 && (
        <div className={styles.probeBadges}>
          {assignedProbes.map(probe => (
            <span
              key={probe.id}
              className={`${styles.probeBadge} ${styles[probe.color]}`}
              title={probe.name}
            />
          ))}
        </div>
      )}
      
      {/* Delete button - upper right corner */}
      <button
        className={styles.deleteButton}
        onClick={handleDelete}
        aria-label="Remove from stash"
        title="Remove"
      >
        ×
      </button>

      {/* Type indicator */}
      <div className={styles.typeIndicator}>
        <span className={styles.typeIcon} aria-hidden="true">
          {stashTypeIcons[item.type]}
        </span>
        <span className={styles.typeLabel}>
          {stashTypeLabels[item.type]}
        </span>
      </div>

      {/* Content area */}
      <div className={styles.content}>
        <p className={styles.mainText}>
          {isExpanded ? displayContent : truncate(displayContent)}
        </p>
        {secondaryInfo && (
          <p className={styles.secondaryText}>
            {secondaryInfo}
          </p>
        )}

        {/* Tags */}
        {item.tags && item.tags.length > 0 && (
          <div className={styles.tags}>
            {item.tags.map((tag, i) => (
              <span key={i} className={styles.tag}>
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Footer with timestamp */}
      <div className={styles.footer}>
        <span className={styles.timestamp}>
          {formatDate(item.createdAt)}
        </span>
      </div>

      {/* Drag handle (if draggable) */}
      {draggable && (
        <div className={styles.dragHandle} aria-hidden="true">
          ⋮⋮
        </div>
      )}
    </div>
  )
}
