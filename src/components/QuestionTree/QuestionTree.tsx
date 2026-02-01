/**
 * @fileoverview Tree visualization component for displaying branching questions.
 * 
 * The QuestionTree renders a hierarchical tree of questions, with visual
 * connector lines between parent and child nodes. It uses recursive rendering
 * via the TreeBranch sub-component.
 * 
 * Structure:
 * - QuestionTree: Container and entry point
 * - TreeBranch: Recursive renderer for each node and its children
 * 
 * Visual Design:
 * - Vertical connector lines on the left of child groups
 * - Horizontal branch lines connecting to each child
 * - Indentation increases with depth
 * - Slide-in animation for new nodes
 */

import { useRef, useEffect, useCallback } from 'react'
import type { QuestionTree as QuestionTreeType, QuestionNode as QuestionNodeType, QuestionNodeAddOptions } from '../../types/question'
import type { ExtractedConcept, ConceptExplanation } from '../../api'
import { QuestionNode } from '../QuestionNode'
import styles from './QuestionTree.module.css'

/**
 * Props for the QuestionTree component.
 */
interface QuestionTreeProps {
  /** The complete tree state */
  tree: QuestionTreeType
  /** Callback when a node is selected */
  onSelectNode: (nodeId: string) => void
  /** Callback when adding a child to a node */
  onAddChild: (parentId: string, question: string, options?: QuestionNodeAddOptions) => void
  /** Callback when toggling a node's expansion */
  onToggleExpand: (nodeId: string) => void
  /** Callback to generate AI suggestions */
  onGenerateAI?: (parentId: string, question: string) => Promise<void>
  /** ID of the node currently generating AI suggestions */
  generatingNodeId?: string | null
  /** Callback to "lock in" on a question and open chat view */
  onLockIn?: (nodeId: string, question: string) => void
  
  // Concept highlighting props
  /** Concepts per node (nodeId -> concepts) */
  nodeConcepts?: Record<string, ExtractedConcept[]>
  /** Map of concept IDs to their explanations (for multiple popups) */
  conceptExplanations?: Record<string, ConceptExplanation>
  /** Map of concept IDs to their loading states (for multiple popups) */
  conceptLoadingStates?: Record<string, { isLoading: boolean; error: string | null }>
  /** Legacy: Current concept explanation */
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
 * Props for the internal TreeBranch component.
 */
interface TreeBranchProps {
  /** The node to render */
  node: QuestionNodeType
  /** The complete tree (needed to look up children) */
  tree: QuestionTreeType
  /** Current depth in the tree (0 = root) */
  depth: number
  /** Callback when a node is selected */
  onSelectNode: (nodeId: string) => void
  /** Callback when adding a child */
  onAddChild: (parentId: string, question: string, options?: QuestionNodeAddOptions) => void
  /** Callback when toggling expansion */
  onToggleExpand: (nodeId: string) => void
  /** Callback to generate AI suggestions */
  onGenerateAI?: (parentId: string, question: string) => Promise<void>
  /** ID of the node currently generating AI suggestions */
  generatingNodeId?: string | null
  /** Callback to "lock in" on a question and open chat view */
  onLockIn?: (nodeId: string, question: string) => void
  
  // Concept highlighting props
  /** Concepts per node (nodeId -> concepts) - needed for recursive rendering */
  nodeConcepts?: Record<string, ExtractedConcept[]>
  /** Concepts for this node */
  concepts?: ExtractedConcept[]
  /** Map of concept IDs to their explanations (for multiple popups) */
  conceptExplanations?: Record<string, ConceptExplanation>
  /** Map of concept IDs to their loading states (for multiple popups) */
  conceptLoadingStates?: Record<string, { isLoading: boolean; error: string | null }>
  /** Legacy: Current concept explanation */
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
 * Recursive component that renders a node and all its descendants.
 * 
 * Each branch consists of:
 * 1. The QuestionNode component for this node
 * 2. A children container with:
 *    - A vertical connector line
 *    - Recursively rendered child branches
 * 
 * The component respects the isExpanded flag - collapsed nodes
 * don't render their children.
 */
function TreeBranch({
  node,
  tree,
  depth,
  onSelectNode,
  onAddChild,
  onToggleExpand,
  onGenerateAI,
  generatingNodeId,
  onLockIn,
  nodeConcepts,
  concepts,
  conceptExplanations,
  conceptLoadingStates,
  conceptExplanation,
  isConceptLoading,
  conceptError,
  onConceptHover,
  onConceptLeave,
  onConceptClick,
  onAddUserConcept,
  onRemoveConcept,
  minimizeAllTrigger,
  closeAllTrigger,
  onOpenPopup,
}: TreeBranchProps) {
  const childrenRef = useRef<HTMLDivElement>(null)
  const connectorRef = useRef<HTMLDivElement>(null)

  // Get actual child node objects from IDs
  const children = node.childIds
    .map((id) => tree.nodes[id])
    .filter(Boolean)

  const hasChildren = children.length > 0
  const isExpanded = node.meta.isExpanded

  // Calculate connector height to stop at last child's horizontal line
  const updateConnectorHeight = useCallback(() => {
    if (!childrenRef.current || !connectorRef.current) return
    
    const childrenEl = childrenRef.current
    const branches = childrenEl.querySelectorAll(':scope > .' + styles.branch)
    
    if (branches.length === 0) return
    
    const lastBranch = branches[branches.length - 1] as HTMLElement
    // The horizontal connector is at var(--space-4) + 2px = 18px from top of branch
    const horizontalConnectorOffset = 18
    const connectorHeight = lastBranch.offsetTop + horizontalConnectorOffset
    
    connectorRef.current.style.height = `${connectorHeight}px`
  }, [])

  // Use ResizeObserver to update connector when container size changes
  // This handles nested children being added/removed
  useEffect(() => {
    if (!hasChildren || !isExpanded || !childrenRef.current) return
    
    // Initial update
    requestAnimationFrame(updateConnectorHeight)
    
    // Watch for size changes (e.g., when grandchildren are added)
    // Guard against environments without ResizeObserver (e.g., test environment)
    if (typeof ResizeObserver === 'undefined') return
    
    const resizeObserver = new ResizeObserver(() => {
      updateConnectorHeight()
    })
    
    resizeObserver.observe(childrenRef.current)
    
    return () => {
      resizeObserver.disconnect()
    }
  }, [hasChildren, isExpanded, updateConnectorHeight])

  return (
    <div 
      className={styles.branch} 
      style={{ '--depth': depth } as React.CSSProperties}
    >
      {/* Render this node */}
      <QuestionNode
        node={node}
        isRoot={depth === 0}
        isActive={node.meta.isActive}
        hasChildren={hasChildren}
        onSelect={onSelectNode}
        onAddChild={onAddChild}
        onToggleExpand={onToggleExpand}
        onGenerateAI={onGenerateAI}
        isGenerating={generatingNodeId === node.id}
        onLockIn={onLockIn}
        concepts={concepts}
        conceptExplanations={conceptExplanations}
        conceptLoadingStates={conceptLoadingStates}
        conceptExplanation={conceptExplanation}
        isConceptLoading={isConceptLoading}
        conceptError={conceptError}
        onConceptHover={onConceptHover}
        onConceptLeave={onConceptLeave}
        onConceptClick={onConceptClick}
        onAddUserConcept={onAddUserConcept}
        onRemoveConcept={onRemoveConcept}
        minimizeAllTrigger={minimizeAllTrigger}
        closeAllTrigger={closeAllTrigger}
        onOpenPopup={onOpenPopup}
      />

      {/* Render children if any and expanded */}
      {hasChildren && isExpanded && (
        <div ref={childrenRef} className={styles.children}>
          {/* Vertical connector line - height calculated dynamically */}
          <div ref={connectorRef} className={styles.connector} aria-hidden="true" />
          
          {/* Recursively render each child */}
          {children.map((child) => (
            <TreeBranch
              key={child.id}
              node={child}
              tree={tree}
              depth={depth + 1}
              onSelectNode={onSelectNode}
              onAddChild={onAddChild}
              onToggleExpand={onToggleExpand}
              onGenerateAI={onGenerateAI}
              generatingNodeId={generatingNodeId}
              onLockIn={onLockIn}
              nodeConcepts={nodeConcepts}
              concepts={nodeConcepts?.[child.id]}
              conceptExplanations={conceptExplanations}
              conceptLoadingStates={conceptLoadingStates}
              conceptExplanation={conceptExplanation}
              isConceptLoading={isConceptLoading}
              conceptError={conceptError}
              onConceptHover={onConceptHover}
              onConceptLeave={onConceptLeave}
              onConceptClick={onConceptClick}
              onAddUserConcept={onAddUserConcept}
              onRemoveConcept={onRemoveConcept}
              minimizeAllTrigger={minimizeAllTrigger}
              closeAllTrigger={closeAllTrigger}
              onOpenPopup={onOpenPopup}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Main tree visualization component.
 * 
 * Renders the entire question tree starting from the root node.
 * Returns null if there's no root (empty tree).
 * 
 * @example
 * ```tsx
 * <QuestionTree
 *   tree={tree}
 *   onSelectNode={setActiveNode}
 *   onAddChild={addChildQuestion}
 *   onToggleExpand={toggleNodeExpansion}
 * />
 * ```
 */
export function QuestionTree({
  tree,
  onSelectNode,
  onAddChild,
  onToggleExpand,
  onGenerateAI,
  generatingNodeId,
  onLockIn,
  nodeConcepts = {},
  conceptExplanations,
  conceptLoadingStates,
  conceptExplanation,
  isConceptLoading,
  conceptError,
  onConceptHover,
  onConceptLeave,
  onConceptClick,
  onAddUserConcept,
  onRemoveConcept,
  minimizeAllTrigger,
  closeAllTrigger,
  onOpenPopup,
}: QuestionTreeProps) {
  // Get the root node
  const rootNode = tree.rootId ? tree.nodes[tree.rootId] : null

  // Don't render anything if tree is empty
  if (!rootNode) {
    return null
  }

  return (
    <div className={styles.container}>
      {/* Start recursive rendering from root */}
      <TreeBranch
        node={rootNode}
        tree={tree}
        depth={0}
        onSelectNode={onSelectNode}
        onAddChild={onAddChild}
        onToggleExpand={onToggleExpand}
        onGenerateAI={onGenerateAI}
        generatingNodeId={generatingNodeId}
        onLockIn={onLockIn}
        nodeConcepts={nodeConcepts}
        concepts={nodeConcepts[rootNode.id]}
        conceptExplanations={conceptExplanations}
        conceptLoadingStates={conceptLoadingStates}
        conceptExplanation={conceptExplanation}
        isConceptLoading={isConceptLoading}
        conceptError={conceptError}
        onConceptHover={onConceptHover}
        onConceptLeave={onConceptLeave}
        onConceptClick={onConceptClick}
        onAddUserConcept={onAddUserConcept}
        onRemoveConcept={onRemoveConcept}
        minimizeAllTrigger={minimizeAllTrigger}
        closeAllTrigger={closeAllTrigger}
        onOpenPopup={onOpenPopup}
      />
    </div>
  )
}
