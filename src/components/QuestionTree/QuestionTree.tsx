import type { QuestionTree as QuestionTreeType, QuestionNode as QuestionNodeType } from '../../types/question'
import { QuestionNode } from '../QuestionNode'
import styles from './QuestionTree.module.css'

interface QuestionTreeProps {
  tree: QuestionTreeType
  onSelectNode: (nodeId: string) => void
  onAddChild: (parentId: string, question: string) => void
  onToggleExpand: (nodeId: string) => void
}

interface TreeBranchProps {
  node: QuestionNodeType
  tree: QuestionTreeType
  depth: number
  onSelectNode: (nodeId: string) => void
  onAddChild: (parentId: string, question: string) => void
  onToggleExpand: (nodeId: string) => void
}

function TreeBranch({
  node,
  tree,
  depth,
  onSelectNode,
  onAddChild,
  onToggleExpand,
}: TreeBranchProps) {
  const children = node.childIds
    .map((id) => tree.nodes[id])
    .filter(Boolean)

  const hasChildren = children.length > 0
  const isExpanded = node.meta.isExpanded

  return (
    <div className={styles.branch} style={{ '--depth': depth } as React.CSSProperties}>
      <QuestionNode
        node={node}
        isRoot={depth === 0}
        isActive={node.meta.isActive}
        hasChildren={hasChildren}
        onSelect={onSelectNode}
        onAddChild={onAddChild}
        onToggleExpand={onToggleExpand}
      />

      {hasChildren && isExpanded && (
        <div className={styles.children}>
          <div className={styles.connector} aria-hidden="true" />
          {children.map((child) => (
            <TreeBranch
              key={child.id}
              node={child}
              tree={tree}
              depth={depth + 1}
              onSelectNode={onSelectNode}
              onAddChild={onAddChild}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function QuestionTree({
  tree,
  onSelectNode,
  onAddChild,
  onToggleExpand,
}: QuestionTreeProps) {
  const rootNode = tree.rootId ? tree.nodes[tree.rootId] : null

  if (!rootNode) {
    return null
  }

  return (
    <div className={styles.container}>
      <TreeBranch
        node={rootNode}
        tree={tree}
        depth={0}
        onSelectNode={onSelectNode}
        onAddChild={onAddChild}
        onToggleExpand={onToggleExpand}
      />
    </div>
  )
}
