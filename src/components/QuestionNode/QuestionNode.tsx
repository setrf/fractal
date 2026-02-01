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

import { useState, useCallback, useRef, useEffect, type KeyboardEvent } from 'react'
import type { QuestionNode as QuestionNodeType, QuestionNodeAddOptions } from '../../types/question'
import type { ExtractedConcept, ConceptExplanation, ConceptCategory } from '../../api'
import { ConceptHighlighter } from '../ConceptHighlighter'
import { ConceptPopup, type PopupPosition, findNonOverlappingPosition, DEFAULT_POPUP_WIDTH, DEFAULT_POPUP_HEIGHT } from '../ConceptPopup'
import { StashButton } from '../StashButton'
import { useStashContext } from '../../context/StashContext'
import styles from './QuestionNode.module.css'

/**
 * State for an open popup.
 */
interface OpenPopup {
  concept: ExtractedConcept
  position: PopupPosition
  isMinimized: boolean
}

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
  onAddChild?: (parentId: string, question: string, options?: QuestionNodeAddOptions) => void
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
  /** Map of concept IDs to their explanations (for multiple popups) */
  conceptExplanations?: Record<string, ConceptExplanation>
  /** Map of concept IDs to their loading states (for multiple popups) */
  conceptLoadingStates?: Record<string, { isLoading: boolean; error: string | null }>
  /** Legacy: Current concept explanation being displayed */
  conceptExplanation?: ConceptExplanation | null
  /** Legacy: Whether concept explanation is loading */
  isConceptLoading?: boolean
  /** Legacy: Error loading concept explanation */
  conceptError?: string | null
  /** Callback when a concept is hovered */
  onConceptHover?: (concept: ExtractedConcept, questionContext?: string) => void
  /** Callback when concept hover ends */
  onConceptLeave?: () => void
  /** Callback when a concept is clicked */
  onConceptClick?: (concept: ExtractedConcept, questionContext?: string) => void
  /** Callback when user creates a highlight by selecting text */
  onAddUserConcept?: (nodeId: string, concept: ExtractedConcept) => void
  /** Callback when user removes a highlight */
  onRemoveConcept?: (nodeId: string, conceptId: string) => void
  
  // Popup control triggers
  /** Trigger to minimize all popups */
  minimizeAllTrigger?: number
  /** Trigger to close all popups */
  closeAllTrigger?: number
  
  // Global popup management (lifted to App level for persistence)
  /** Callback to open a popup at a given position (managed globally) */
  onOpenPopup?: (concept: ExtractedConcept, position: { x: number; y: number }) => void
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
  conceptExplanations = {},
  conceptLoadingStates = {},
  conceptExplanation,
  isConceptLoading = false,
  conceptError,
  onConceptHover,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onConceptLeave: _onConceptLeave, // Intentionally unused - popup stays open until user closes
  onConceptClick,
  onAddUserConcept,
  onRemoveConcept,
  // Popup control triggers
  minimizeAllTrigger = 0,
  closeAllTrigger = 0,
  // Global popup management
  onOpenPopup,
}: QuestionNodeProps) {
  // State for the inline add-child form
  const [isAddingChild, setIsAddingChild] = useState(false)
  const [newQuestion, setNewQuestion] = useState('')
  
  // State for concept popups (supports multiple open popups)
  const [openPopups, setOpenPopups] = useState<OpenPopup[]>([])

  // Respond to minimize all trigger from parent
  useEffect(() => {
    if (minimizeAllTrigger > 0) {
      setOpenPopups(prev => prev.map(p => ({ ...p, isMinimized: true })))
    }
  }, [minimizeAllTrigger])

  // Respond to close all trigger from parent
  useEffect(() => {
    if (closeAllTrigger > 0) {
      setOpenPopups([])
    }
  }, [closeAllTrigger])
  
  // Ref for content area (used for text selection detection)
  const contentRef = useRef<HTMLDivElement>(null)
  
  // Stash context for adding questions to stash
  const { addItem, hasItem } = useStashContext()
  
  // Check if question is already stashed
  const isQuestionStashed = hasItem(node.text, 'question')
  
  /**
   * Stashes the current question to the Stash.
   */
  const handleStashQuestion = useCallback(() => {
    addItem({
      type: 'question',
      content: node.text,
      metadata: {
        questionId: node.id,
      },
    })
  }, [addItem, node.text, node.id])

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
   * Handles concept hover - opens a new popup.
   * Multiple popups can be open at the same time.
   * Prevents duplicates by checking normalizedName (same concept = same popup).
   * Positions new popups to avoid overlapping with existing ones.
   */
  const handleConceptHover = useCallback((concept: ExtractedConcept, event: React.MouseEvent) => {
    // If global popup management is enabled, delegate to App
    if (onOpenPopup) {
      onOpenPopup(concept, { x: event.clientX + 10, y: event.clientY + 10 })
      onConceptHover?.(concept, node.text)
      return
    }
    
    // Fallback to local popup management
    // Check if this concept already has an open popup (by normalizedName to prevent duplicates)
    const existingPopup = openPopups.find(p => 
      p.concept.id === concept.id || p.concept.normalizedName === concept.normalizedName
    )
    if (existingPopup) return
    
    // Find non-overlapping position for new popup
    const existingPositions = openPopups.map(p => ({
      x: p.position.x,
      y: p.position.y,
      width: DEFAULT_POPUP_WIDTH,
      height: DEFAULT_POPUP_HEIGHT,
      isMinimized: p.isMinimized,
    }))
    const position = findNonOverlappingPosition(
      event.clientX + 10,
      event.clientY + 10,
      existingPositions
    )
    
    // Add new popup
    const newPopup: OpenPopup = {
      concept,
      position,
      isMinimized: false,
    }
    setOpenPopups(prev => [...prev, newPopup])
    onConceptHover?.(concept, node.text)
  }, [node.text, openPopups, onConceptHover, onOpenPopup])

  /**
   * Handles concept hover end - no-op since popups are persistent.
   * Popup only closes when user explicitly clicks close button.
   */
  const handleConceptLeave = useCallback(() => {
    // Don't close popup on mouse leave - user must click close button
    // This provides a better UX for reading explanations
  }, [])

  /**
   * Handles concept click - opens popup if not already open.
   * Prevents duplicates by checking normalizedName (same concept = same popup).
   * Positions new popups to avoid overlapping with existing ones.
   */
  const handleConceptClick = useCallback((concept: ExtractedConcept, event: React.MouseEvent) => {
    event.stopPropagation()
    
    // If global popup management is enabled, delegate to App
    if (onOpenPopup) {
      onOpenPopup(concept, { x: event.clientX + 10, y: event.clientY + 10 })
      onConceptClick?.(concept, node.text)
      return
    }
    
    // Fallback to local popup management
    // Check if this concept already has an open popup (by normalizedName to prevent duplicates)
    const existingPopup = openPopups.find(p => 
      p.concept.id === concept.id || p.concept.normalizedName === concept.normalizedName
    )
    if (existingPopup) return
    
    // Find non-overlapping position for new popup
    const existingPositions = openPopups.map(p => ({
      x: p.position.x,
      y: p.position.y,
      width: DEFAULT_POPUP_WIDTH,
      height: DEFAULT_POPUP_HEIGHT,
      isMinimized: p.isMinimized,
    }))
    const position = findNonOverlappingPosition(
      event.clientX + 10,
      event.clientY + 10,
      existingPositions
    )
    
    // Add new popup
    const newPopup: OpenPopup = {
      concept,
      position,
      isMinimized: false,
    }
    setOpenPopups(prev => [...prev, newPopup])
    onConceptClick?.(concept, node.text)
  }, [node.text, openPopups, onConceptClick, onOpenPopup])

  /**
   * Handles popup minimize state change.
   * Updates the popup's isMinimized state for stack index calculation.
   */
  const handlePopupMinimizeChange = useCallback((conceptId: string, isMinimized: boolean) => {
    setOpenPopups(prev => prev.map(p => 
      p.concept.id === conceptId ? { ...p, isMinimized } : p
    ))
  }, [])

  /**
   * Handles popup close for a specific concept.
   * Note: We don't call onConceptLeave here because that would reset ALL explanations.
   * Each popup manages its own lifecycle independently.
   */
  const handlePopupClose = useCallback((conceptId: string) => {
    setOpenPopups(prev => prev.filter(p => p.concept.id !== conceptId))
  }, [])

  /**
   * Handles clicking a related concept in a popup.
   * Creates a new popup for the related concept.
   */
  const handleRelatedConceptClick = useCallback((conceptName: string) => {
    // Check if this concept already has an open popup
    const existingPopup = openPopups.find(p => 
      p.concept.normalizedName === conceptName.toLowerCase()
    )
    if (existingPopup) return
    
    // Create a synthetic concept for the related item
    const syntheticConcept: ExtractedConcept = {
      id: `related_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      text: conceptName,
      normalizedName: conceptName.toLowerCase(),
      category: 'abstract',  // Default category for related concepts
      startIndex: -1,  // Not in the original text
      endIndex: -1,
    }
    
    // Find non-overlapping position
    const existingPositions = openPopups.map(p => ({
      x: p.position.x,
      y: p.position.y,
      width: DEFAULT_POPUP_WIDTH,
      height: DEFAULT_POPUP_HEIGHT,
      isMinimized: p.isMinimized,
    }))
    
    // Position near center of viewport for related concepts
    const position = findNonOverlappingPosition(
      window.innerWidth / 2 - DEFAULT_POPUP_WIDTH / 2,
      window.innerHeight / 3,
      existingPositions
    )
    
    // Add new popup
    const newPopup: OpenPopup = {
      concept: syntheticConcept,
      position,
      isMinimized: false,
    }
    setOpenPopups(prev => [...prev, newPopup])
    
    // Trigger explanation fetch if callback exists
    onConceptClick?.(syntheticConcept, node.text)
  }, [node.text, openPopups, onConceptClick])

  /**
   * Handles text selection for user-created highlights.
   * Automatically creates a highlight when valid text is selected.
   */
  const handleTextSelect = useCallback(() => {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed || !contentRef.current) {
      return
    }

    const rawSelectedText = selection.toString()
    const selectedText = rawSelectedText.trim()
    if (!selectedText || selectedText.length < 2) {
      return
    }

    // Check if selection is within our content area
    const range = selection.getRangeAt(0)
    const textRoot = contentRef.current.querySelector(`.${styles.text}`) as HTMLElement | null
    if (!textRoot || !textRoot.contains(range.commonAncestorContainer)) {
      return
    }

    const getTextOffset = (container: Node, offset: number): number | null => {
      let node: Node | null = container
      let nodeOffset = offset

      if (node.nodeType !== Node.TEXT_NODE) {
        const child = node.childNodes[offset]
        if (child && child.nodeType === Node.TEXT_NODE) {
          node = child
          nodeOffset = 0
        } else {
          return null
        }
      }

      const walker = document.createTreeWalker(
        textRoot,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: (textNode) => {
            const parent = (textNode as Text).parentElement
            if (parent?.closest('button')) {
              return NodeFilter.FILTER_REJECT
            }
            return NodeFilter.FILTER_ACCEPT
          },
        }
      )

      let total = 0
      let current = walker.nextNode()
      while (current) {
        if (current === node) {
          const length = current.textContent?.length || 0
          return total + Math.min(nodeOffset, length)
        }
        total += current.textContent?.length || 0
        current = walker.nextNode()
      }
      return null
    }

    const startOffset = getTextOffset(range.startContainer, range.startOffset)
    const endOffset = getTextOffset(range.endContainer, range.endOffset)
    if (startOffset === null || endOffset === null) {
      return
    }

    const leadingWhitespace = rawSelectedText.length - rawSelectedText.trimStart().length
    const trailingWhitespace = rawSelectedText.length - rawSelectedText.trimEnd().length
    const startIndex = startOffset + leadingWhitespace
    const endIndex = endOffset - trailingWhitespace
    if (endIndex <= startIndex) return

    // Check if this overlaps with an existing concept
    const overlapsExisting = concepts.some(
      c => (startIndex < c.endIndex && endIndex > c.startIndex)
    )
    if (overlapsExisting) {
      return
    }

    // Automatically create the highlight (no intermediate step)
    if (onAddUserConcept) {
      const selectedSlice = node.text.slice(startIndex, endIndex)
      const newConcept: ExtractedConcept = {
        id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        text: selectedSlice,
        normalizedName: selectedSlice.toLowerCase(),
        category: 'abstract' as ConceptCategory,
        startIndex,
        endIndex,
      }
      onAddUserConcept(node.id, newConcept)
    }

    // Clear the selection
    window.getSelection()?.removeAllRanges()
  }, [node.text, concepts, onAddUserConcept, node.id])

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
        <div 
          ref={contentRef}
          className={styles.content}
          onMouseUp={onAddUserConcept ? handleTextSelect : undefined}
        >
          <span className={styles.prefix}>?</span>
          {concepts.length > 0 ? (
            <ConceptHighlighter
              text={node.text}
              concepts={concepts}
              className={styles.text}
              onConceptHover={handleConceptHover}
              onConceptLeave={handleConceptLeave}
              onConceptClick={handleConceptClick}
              onConceptRemove={onRemoveConcept ? (conceptId) => onRemoveConcept(node.id, conceptId) : undefined}
            />
          ) : (
            <span className={styles.text}>{node.text}</span>
          )}
        </div>
        {/* Action buttons - horizontal row at bottom right */}
        <div className={styles.actions}>
          {typeof node.meta.qualityScore === 'number' && (
            <span className={styles.qualityBadge}>
              Quality {node.meta.qualityScore.toFixed(2)} / 10
            </span>
          )}
          {/* Stash button - add question to stash */}
          <StashButton
            onClick={handleStashQuestion}
            isStashed={isQuestionStashed}
            size="small"
            className={styles.stashBtn}
          />
          
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

      {/* Concept explanation popups - multiple can be open */}
      {/* Only render locally if global popup management is NOT enabled */}
      {!onOpenPopup && openPopups.map((popup, _index) => {
        // Get explanation for this specific popup from the maps, or fall back to legacy props
        const explanation = conceptExplanations[popup.concept.id] 
          || (conceptExplanation?.conceptId === popup.concept.id ? conceptExplanation : null)
        const loadingState = conceptLoadingStates[popup.concept.id]
        const isLoading = loadingState?.isLoading ?? (conceptExplanation?.conceptId === popup.concept.id ? isConceptLoading : false)
        const error = loadingState?.error ?? (conceptExplanation?.conceptId === popup.concept.id ? conceptError : null)
        
        // Calculate stack index for minimized popups (count how many minimized popups are before this one)
        const minimizedStackIndex = openPopups
          .filter((p, i) => p.isMinimized && i < openPopups.indexOf(popup))
          .length
        
        return (
          <ConceptPopup
            key={popup.concept.id}
            concept={popup.concept}
            explanation={explanation}
            isLoading={isLoading}
            error={error}
            position={popup.position}
            onClose={() => handlePopupClose(popup.concept.id)}
            onRelatedConceptClick={handleRelatedConceptClick}
            onMinimizeChange={handlePopupMinimizeChange}
            minimizedStackIndex={minimizedStackIndex}
          />
        )
      })}
    </div>
  )
}
