/**
 * @fileoverview Popup component for displaying graph node details.
 *
 * Shows contextual information when a node is clicked in the 3D graph:
 * - Question: Full text, child count, actions
 * - Concept: Name, category, explanation preview
 * - Stash Item: Content preview, type badge
 * - Probe: Name, color, message count
 */

import type { GraphNode } from '../../types/graph'
import type { QuestionNode } from '../../types/question'
import type { ExtractedConcept } from '../../types/concept'
import type { StashItem } from '../../types/stash'
import type { Probe } from '../../types/probe'
import { categoryLabels } from '../../types/concept'
import { stashTypeLabels, stashTypeIcons } from '../../types/stash'
import { probeColorLabels } from '../../types/probe'
import styles from './GraphNodePopup.module.css'

/**
 * Props for the GraphNodePopup component.
 */
export interface GraphNodePopupProps {
  /** The graph node to display */
  node: GraphNode
  /** Position for the popup (screen coordinates) */
  position: { x: number; y: number }
  /** Close the popup */
  onClose: () => void
  /** Action callbacks */
  onDeepDive?: (nodeId: string, question: string) => void
  onChat?: (nodeId: string, question: string) => void
  onStash?: (node: GraphNode) => void
}

/**
 * Type guard for QuestionNode data.
 */
function isQuestionNode(data: unknown): data is QuestionNode {
  return typeof data === 'object' && data !== null && 'text' in data && 'childIds' in data
}

/**
 * Type guard for ExtractedConcept data.
 */
function isConcept(data: unknown): data is ExtractedConcept {
  return typeof data === 'object' && data !== null && 'normalizedName' in data && 'category' in data
}

/**
 * Type guard for StashItem data.
 */
function isStashItem(data: unknown): data is StashItem {
  return typeof data === 'object' && data !== null && 'type' in data && 'metadata' in data
}

/**
 * Type guard for Probe data.
 */
function isProbe(data: unknown): data is Probe {
  return typeof data === 'object' && data !== null && 'messages' in data && 'color' in data
}

/**
 * Popup component for graph node details.
 */
export function GraphNodePopup({
  node,
  position,
  onClose,
  onDeepDive,
  onChat,
  onStash,
}: GraphNodePopupProps) {
  const isMobile = window.innerWidth <= 768

  // Calculate popup position (ensure it stays within viewport)
  const popupStyle = isMobile ? {} : {
    left: Math.min(position.x, window.innerWidth - 320),
    top: Math.min(position.y, window.innerHeight - 300),
  }

  // Render content based on node type
  const renderContent = () => {
    switch (node.type) {
      case 'question':
        if (isQuestionNode(node.data)) {
          const question = node.data
          return (
            <div className={styles.content}>
              <div className={styles.typeLabel} data-type="question">
                Question
              </div>
              <p className={styles.questionText}>{question.text}</p>
              <div className={styles.meta}>
                <span>{question.childIds.length} sub-questions</span>
                {typeof question.meta.qualityScore === 'number' && (
                  <span>Quality {question.meta.qualityScore.toFixed(2)} / 10</span>
                )}
              </div>
              <div className={styles.actions}>
                {onDeepDive && (
                  <button
                    className={styles.actionBtn}
                    onClick={() => onDeepDive(question.id, question.text)}
                  >
                    Deep dive
                  </button>
                )}
                {onChat && (
                  <button
                    className={styles.actionBtn}
                    onClick={() => onChat(question.id, question.text)}
                  >
                    Chat
                  </button>
                )}
              </div>
            </div>
          )
        }
        break

      case 'concept':
        if (isConcept(node.data)) {
          const concept = node.data
          return (
            <div className={styles.content}>
              <div className={styles.typeLabel} data-type="concept">
                {categoryLabels[concept.category]}
              </div>
              <h3 className={styles.conceptName}>{concept.normalizedName}</h3>
              <p className={styles.conceptText}>"{concept.text}"</p>
              <div className={styles.actions}>
                {onStash && (
                  <button
                    className={styles.actionBtn}
                    onClick={() => onStash(node)}
                  >
                    Add to Stash
                  </button>
                )}
              </div>
            </div>
          )
        }
        break

      case 'stash':
        if (isStashItem(node.data)) {
          const item = node.data
          const icon = stashTypeIcons[item.type]
          const label = stashTypeLabels[item.type]
          return (
            <div className={styles.content}>
              <div className={styles.typeLabel} data-type="stash">
                {icon} {label}
              </div>
              <p className={styles.stashContent}>
                {item.content.length > 150
                  ? item.content.slice(0, 150) + '...'
                  : item.content}
              </p>
              {item.metadata.title && (
                <div className={styles.meta}>
                  <span>Title: {item.metadata.title}</span>
                </div>
              )}
            </div>
          )
        }
        break

      case 'probe':
        if (isProbe(node.data)) {
          const probe = node.data
          return (
            <div className={styles.content}>
              <div
                className={styles.typeLabel}
                data-type="probe"
                style={{ color: `var(--chart-${probe.color === 'blue' ? '1' : probe.color === 'green' ? '2' : probe.color === 'yellow' ? '3' : probe.color === 'purple' ? '4' : '5'})` }}
              >
                Probe
              </div>
              <h3 className={styles.probeName}>{probe.name}</h3>
              <div className={styles.probeMeta}>
                <span className={styles.probeColor} data-color={probe.color}>
                  {probeColorLabels[probe.color]}
                </span>
                <span>{probe.messages.length} messages</span>
                <span>{probe.selectedStashItemIds.length} items selected</span>
              </div>
            </div>
          )
        }
        break
    }

    // Fallback for unknown data
    return (
      <div className={styles.content}>
        <div className={styles.typeLabel}>{node.type}</div>
        <p>{node.label}</p>
      </div>
    )
  }

  return (
    <div className={styles.popup} style={popupStyle}>
      <button
        className={styles.closeBtn}
        onClick={onClose}
        aria-label="Close popup"
      >
        ×
      </button>
      {renderContent()}
    </div>
  )
}
