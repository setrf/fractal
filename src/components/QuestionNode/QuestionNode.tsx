/**
 * @fileoverview Individual question node component for the tree visualization.
 * 
 * Each node displays a question with its "?" prefix and provides actions:
 * - Click to select/focus the node
 * - Expand/collapse button for nodes with children
 * - Add child button to create branching questions
 * - Concept highlighting with interactive popups
 * 
 * Design:
 * - Neobrutalist styling with hard edges and bold borders
 * - Root nodes have thicker borders
 * - Active nodes show offset shadow
 * - Inline form for adding children without modal
 * - Gwern-style concept popups for highlighted terms
 */

import { useState, useCallback, KeyboardEvent } from 'react'
import type { QuestionNode as QuestionNodeType } from '../../types/question'
import type { ExtractedConcept, ConceptExplanation } from '../../api'
import { ConceptHighlighter } from '../ConceptHighlighter'
import { ConceptPopup, type PopupPosition } from '../ConceptPopup'
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
  /** Callback to "lock in" on this question and open chat view */
  onLockIn?: (nodeId: string, question: string) => void
  
  // Concept highlighting props
  /** Extracted concepts to highlight in the question text */
  concepts?: ExtractedConcept[]
  /** Current concept explanation being displayed */
  conceptExplanation?: ConceptExplanation | null
  /** Whether concept explanation is loading */
  isConceptLoading?: boolean
  /** Error loading concept explanation */
  conceptError?: string | null
  /** Callback when a concept is hovered */
  onConceptHover?: (concept: ExtractedConcept) => void
  /** Callback when concept hover ends */
  onConceptLeave?: () => void
  /** Callback when a concept is clicked */
  onConceptClick?: (concept: ExtractedConcept) => void
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
  onLockIn,
  // Concept props
  concepts = [],
  conceptExplanation,
  isConceptLoading = false,
  conceptError,
  onConceptHover,
  onConceptLeave,
  onConceptClick,
}: QuestionNodeProps) {
  // State for the inline add-child form
  const [isAddingChild, setIsAddingChild] = useState(false)
  const [newQuestion, setNewQuestion] = useState('')
  
  // State for concept popup
  const [hoveredConcept, setHoveredConcept] = useState<ExtractedConcept | null>(null)
  const [popupPosition, setPopupPosition] = useState<PopupPosition>({ x: 0, y: 0 })
  const [isPopupSticky, setIsPopupSticky] = useState(false)

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
   * Handles "lock in" to open chat view for this question.
   */
  const handleLockIn = (e: React.MouseEvent) => {
    e.stopPropagation()
    onLockIn?.(node.id, node.text)
  }

  /**
   * Handles concept hover - shows popup and makes it sticky.
   * Popup only closes when user clicks the close button.
   */
  const handleConceptHover = useCallback((concept: ExtractedConcept, event: React.MouseEvent) => {
    // Only show new popup if no popup is currently displayed
    if (!hoveredConcept) {
      setHoveredConcept(concept)
      setPopupPosition({ x: event.clientX + 10, y: event.clientY + 10 })
      setIsPopupSticky(true)  // Make sticky immediately so it doesn't disappear
      onConceptHover?.(concept)
    }
  }, [hoveredConcept, onConceptHover])

  /**
   * Handles concept hover end - no-op since popups are sticky by default.
   * Popup only closes when user explicitly clicks close button.
   */
  const handleConceptLeave = useCallback(() => {
    // Don't close popup on mouse leave - user must click close button
    // This provides a better UX for reading explanations
  }, [])

  /**
   * Handles concept click - makes popup sticky.
   */
  const handleConceptClick = useCallback((concept: ExtractedConcept, event: React.MouseEvent) => {
    event.stopPropagation()
    setHoveredConcept(concept)
    setPopupPosition({ x: event.clientX + 10, y: event.clientY + 10 })
    setIsPopupSticky(true)
    onConceptClick?.(concept)
  }, [onConceptClick])

  /**
   * Handles popup close.
   */
  const handlePopupClose = useCallback(() => {
    setHoveredConcept(null)
    setIsPopupSticky(false)
    onConceptLeave?.()
  }, [onConceptLeave])

  /**
   * Handles popup sticky state change.
   */
  const handleStickyChange = useCallback((sticky: boolean) => {
    setIsPopupSticky(sticky)
  }, [])

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
          {concepts.length > 0 ? (
            <ConceptHighlighter
              text={node.text}
              concepts={concepts}
              className={styles.text}
              onConceptHover={handleConceptHover}
              onConceptLeave={handleConceptLeave}
              onConceptClick={handleConceptClick}
            />
          ) : (
            <span className={styles.text}>{node.text}</span>
          )}
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
          
          {/* AI generate button - branch into more questions */}
          {onGenerateAI && (
            <button
              className={`${styles.aiBtn} ${isGenerating ? styles.generating : ''}`}
              onClick={handleGenerateAI}
              disabled={isGenerating}
              aria-label="Generate AI suggestions"
              title="Generate related questions to explore"
            >
              <span className={styles.icon}>{isGenerating ? '◌' : '✦'}</span>
              <span>Deep dive</span>
            </button>
          )}

          {/* Lock in button - explore this question deeply */}
          {onLockIn && (
            <button
              className={styles.lockInBtn}
              onClick={handleLockIn}
              aria-label="Chat about this question"
              title="Start a conversation about this question"
            >
              <span className={styles.icon}>→</span>
              <span>Chat</span>
            </button>
          )}
          
          {/* Add child button - always visible */}
          <button
            className={styles.addBtn}
            onClick={handleAddChildClick}
            aria-label="Customize with your own question"
            title="Add your own related question"
          >
            <span className={styles.icon}>↳</span>
            <span>Customize</span>
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

      {/* Concept explanation popup */}
      {hoveredConcept && (
        <ConceptPopup
          concept={hoveredConcept}
          explanation={conceptExplanation || null}
          isLoading={isConceptLoading}
          error={conceptError}
          position={popupPosition}
          isSticky={isPopupSticky}
          onClose={handlePopupClose}
          onStickyChange={handleStickyChange}
        />
      )}
    </div>
  )
}
