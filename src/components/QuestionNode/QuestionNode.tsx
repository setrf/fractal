/**
 * @fileoverview Individual question node component for the tree visualization.
 * 
 * Each node displays a question with its "?" prefix and provides actions:
 * - Click to select/focus the node
 * - Expand/collapse button for nodes with children
 * - Add child button to create branching questions
 * 
 * Design:
 * - Neobrutalist styling with hard edges and bold borders
 * - Root nodes have thicker borders
 * - Active nodes show offset shadow
 * - Inline form for adding children without modal
 */

import { useState, KeyboardEvent } from 'react'
import type { QuestionNode as QuestionNodeType } from '../../types/question'
import styles from './QuestionNode.module.css'

/**
 * Props for the QuestionNode component.
 */
interface QuestionNodeProps {
  /** The question node data to display */
  node: QuestionNodeType
  /** Whether this is the root node (affects styling) */
  isRoot?: boolean
  /** Whether this node is currently active/focused */
  isActive?: boolean
  /** Whether this node has children (affects expand button visibility) */
  hasChildren?: boolean
  /** Callback when node is clicked/selected */
  onSelect?: (nodeId: string) => void
  /** Callback when adding a child question */
  onAddChild?: (parentId: string, question: string) => void
  /** Callback when toggling expand/collapse */
  onToggleExpand?: (nodeId: string) => void
  /** Callback to generate AI suggestions for this question */
  onGenerateAI?: (parentId: string, question: string) => Promise<void>
  /** Whether AI generation is in progress for this node */
  isGenerating?: boolean
}

/**
 * Displays a single question node with interactive capabilities.
 * 
 * The node shows the question text with a "?" prefix and provides
 * action buttons for tree manipulation. It also includes an inline
 * form for adding child questions.
 * 
 * @example
 * ```tsx
 * <QuestionNode
 *   node={questionNode}
 *   isRoot={true}
 *   isActive={node.id === activeId}
 *   hasChildren={node.childIds.length > 0}
 *   onSelect={handleSelect}
 *   onAddChild={handleAddChild}
 *   onToggleExpand={handleToggle}
 * />
 * ```
 */
export function QuestionNode({
  node,
  isRoot = false,
  isActive = false,
  hasChildren = false,
  onSelect,
  onAddChild,
  onToggleExpand,
  onGenerateAI,
  isGenerating = false,
}: QuestionNodeProps) {
  // State for the inline add-child form
  const [isAddingChild, setIsAddingChild] = useState(false)
  const [newQuestion, setNewQuestion] = useState('')

  /**
   * Handles click on the node body to select it.
   */
  const handleClick = () => {
    onSelect?.(node.id)
  }

  /**
   * Handles expand/collapse button click.
   * Stops propagation to prevent selecting the node.
   */
  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation()
    onToggleExpand?.(node.id)
  }

  /**
   * Opens the inline form for adding a child question.
   */
  const handleAddChildClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsAddingChild(true)
  }

  /**
   * Triggers AI generation of related questions.
   */
  const handleGenerateAI = (e: React.MouseEvent) => {
    e.stopPropagation()
    onGenerateAI?.(node.id, node.text)
  }

  /**
   * Submits the new child question.
   */
  const handleSubmitChild = () => {
    const trimmed = newQuestion.trim()
    if (trimmed) {
      onAddChild?.(node.id, trimmed)
      setNewQuestion('')
      setIsAddingChild(false)
    }
  }

  /**
   * Handles keyboard events in the child input.
   * Enter to submit, Escape to cancel.
   */
  const handleChildKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSubmitChild()
    } else if (e.key === 'Escape') {
      setNewQuestion('')
      setIsAddingChild(false)
    }
  }

  return (
    <div className={styles.container}>
      {/* Main node element */}
      <div
        className={`${styles.node} ${isRoot ? styles.root : ''} ${isActive ? styles.active : ''}`}
        onClick={handleClick}
        tabIndex={0}
        role="button"
        aria-label={`Question: ${node.text}`}
        aria-expanded={hasChildren ? node.meta.isExpanded : undefined}
      >
        {/* Question content with prefix */}
        <div className={styles.content}>
          <span className={styles.prefix}>?</span>
          <span className={styles.text}>{node.text}</span>
        </div>

        {/* Action buttons */}
        <div className={styles.actions}>
          {/* Expand/collapse button - only shown if node has children */}
          {hasChildren && (
            <button
              className={styles.expandBtn}
              onClick={handleToggleExpand}
              aria-label={node.meta.isExpanded ? 'Collapse' : 'Expand'}
            >
              {node.meta.isExpanded ? '−' : '+'}
            </button>
          )}
          
          {/* AI generate button */}
          {onGenerateAI && (
            <button
              className={`${styles.aiBtn} ${isGenerating ? styles.generating : ''}`}
              onClick={handleGenerateAI}
              disabled={isGenerating}
              aria-label="Generate AI suggestions"
              title="Generate related questions with AI"
            >
              {isGenerating ? '◌' : '✦'}
            </button>
          )}
          
          {/* Add child button - always visible */}
          <button
            className={styles.addBtn}
            onClick={handleAddChildClick}
            aria-label="Add related question"
          >
            ↳
          </button>
        </div>
      </div>

      {/* Inline form for adding child questions */}
      {isAddingChild && (
        <div className={styles.addChildForm}>
          {/* Visual branch connector */}
          <span className={styles.branchLine}>├─</span>
          
          {/* Child question input */}
          <input
            type="text"
            className={styles.childInput}
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
            onKeyDown={handleChildKeyDown}
            placeholder="What comes next?"
            autoFocus
          />
          
          {/* Submit button */}
          <button
            className={styles.submitChild}
            onClick={handleSubmitChild}
            disabled={!newQuestion.trim()}
          >
            →
          </button>
          
          {/* Cancel button */}
          <button
            className={styles.cancelChild}
            onClick={() => {
              setNewQuestion('')
              setIsAddingChild(false)
            }}
          >
            ×
          </button>
        </div>
      )}
    </div>
  )
}
