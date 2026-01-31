import { useState, KeyboardEvent } from 'react'
import type { QuestionNode as QuestionNodeType } from '../../types/question'
import styles from './QuestionNode.module.css'

interface QuestionNodeProps {
  node: QuestionNodeType
  isRoot?: boolean
  isActive?: boolean
  hasChildren?: boolean
  onSelect?: (nodeId: string) => void
  onAddChild?: (parentId: string, question: string) => void
  onToggleExpand?: (nodeId: string) => void
}

export function QuestionNode({
  node,
  isRoot = false,
  isActive = false,
  hasChildren = false,
  onSelect,
  onAddChild,
  onToggleExpand,
}: QuestionNodeProps) {
  const [isAddingChild, setIsAddingChild] = useState(false)
  const [newQuestion, setNewQuestion] = useState('')

  const handleClick = () => {
    onSelect?.(node.id)
  }

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation()
    onToggleExpand?.(node.id)
  }

  const handleAddChildClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsAddingChild(true)
  }

  const handleSubmitChild = () => {
    const trimmed = newQuestion.trim()
    if (trimmed) {
      onAddChild?.(node.id, trimmed)
      setNewQuestion('')
      setIsAddingChild(false)
    }
  }

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
      <div
        className={`${styles.node} ${isRoot ? styles.root : ''} ${isActive ? styles.active : ''}`}
        onClick={handleClick}
        tabIndex={0}
        role="button"
        aria-label={`Question: ${node.text}`}
        aria-expanded={hasChildren ? node.meta.isExpanded : undefined}
      >
        <div className={styles.content}>
          <span className={styles.prefix}>?</span>
          <span className={styles.text}>{node.text}</span>
        </div>

        <div className={styles.actions}>
          {hasChildren && (
            <button
              className={styles.expandBtn}
              onClick={handleToggleExpand}
              aria-label={node.meta.isExpanded ? 'Collapse' : 'Expand'}
            >
              {node.meta.isExpanded ? '−' : '+'}
            </button>
          )}
          <button
            className={styles.addBtn}
            onClick={handleAddChildClick}
            aria-label="Add related question"
          >
            ↳
          </button>
        </div>
      </div>

      {isAddingChild && (
        <div className={styles.addChildForm}>
          <span className={styles.branchLine}>├─</span>
          <input
            type="text"
            className={styles.childInput}
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
            onKeyDown={handleChildKeyDown}
            placeholder="What comes next?"
            autoFocus
          />
          <button
            className={styles.submitChild}
            onClick={handleSubmitChild}
            disabled={!newQuestion.trim()}
          >
            →
          </button>
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
