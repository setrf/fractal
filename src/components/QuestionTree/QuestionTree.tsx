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
      />
    </div>
  )
}
