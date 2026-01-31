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

import type { QuestionTree as QuestionTreeType, QuestionNode as QuestionNodeType } from '../../types/question'
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
  onAddChild: (parentId: string, question: string) => void
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
  onConceptHover?: (concept: ExtractedConcept) => void
  /** Callback when concept hover ends */
  onConceptLeave?: () => void
  /** Callback when a concept is clicked */
  onConceptClick?: (concept: ExtractedConcept) => void
  /** Callback when user creates a highlight by selecting text */
  onAddUserConcept?: (nodeId: string, concept: ExtractedConcept) => void
  /** Callback when user removes a highlight */
  onRemoveConcept?: (nodeId: string, conceptId: string) => void
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
  onAddChild: (parentId: string, question: string) => void
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
  onConceptHover?: (concept: ExtractedConcept) => void
  /** Callback when concept hover ends */
  onConceptLeave?: () => void
  /** Callback when a concept is clicked */
  onConceptClick?: (concept: ExtractedConcept) => void
  /** Callback when user creates a highlight by selecting text */
  onAddUserConcept?: (nodeId: string, concept: ExtractedConcept) => void
  /** Callback when user removes a highlight */
  onRemoveConcept?: (nodeId: string, conceptId: string) => void
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
}: TreeBranchProps) {
  // Get actual child node objects from IDs
  const children = node.childIds
    .map((id) => tree.nodes[id])
    .filter(Boolean)

  const hasChildren = children.length > 0
  const isExpanded = node.meta.isExpanded

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
      />

      {/* Render children if any and expanded */}
      {hasChildren && isExpanded && (
        <div className={styles.children}>
          {/* Vertical connector line */}
          <div className={styles.connector} aria-hidden="true" />
          
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
      />
    </div>
  )
}
