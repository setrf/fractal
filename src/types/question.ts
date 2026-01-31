/**
 * Core types for the Fractal question system
 */

export interface QuestionNode {
  /** Unique identifier for this question node */
  id: string
  
  /** The question text */
  text: string
  
  /** Parent node ID (null for root) */
  parentId: string | null
  
  /** Child question node IDs */
  childIds: string[]
  
  /** Position in the tree for visualization */
  position: {
    x: number
    y: number
  }
  
  /** Metadata */
  meta: {
    createdAt: number
    isExpanded: boolean
    isActive: boolean
  }
}

export interface QuestionTree {
  /** All nodes indexed by ID for O(1) lookup */
  nodes: Record<string, QuestionNode>
  
  /** Root node ID */
  rootId: string | null
  
  /** Currently focused/active node ID */
  activeId: string | null
}

/** Initial empty tree state */
export const createEmptyTree = (): QuestionTree => ({
  nodes: {},
  rootId: null,
  activeId: null,
})

/** Generate a unique ID */
export const generateId = (): string => {
  return `q_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

/** Create a new question node */
export const createQuestionNode = (
  text: string,
  parentId: string | null = null,
  position: { x: number; y: number } = { x: 0, y: 0 }
): QuestionNode => ({
  id: generateId(),
  text,
  parentId,
  childIds: [],
  position,
  meta: {
    createdAt: Date.now(),
    isExpanded: true,
    isActive: false,
  },
})

/** Add a node to the tree */
export const addNodeToTree = (
  tree: QuestionTree,
  node: QuestionNode
): QuestionTree => {
  const newNodes = { ...tree.nodes, [node.id]: node }
  
  // Update parent's childIds if there's a parent
  if (node.parentId && newNodes[node.parentId]) {
    newNodes[node.parentId] = {
      ...newNodes[node.parentId],
      childIds: [...newNodes[node.parentId].childIds, node.id],
    }
  }
  
  return {
    ...tree,
    nodes: newNodes,
    rootId: node.parentId === null ? node.id : tree.rootId,
    activeId: node.id,
  }
}

/** Get all children of a node */
export const getChildren = (
  tree: QuestionTree,
  nodeId: string
): QuestionNode[] => {
  const node = tree.nodes[nodeId]
  if (!node) return []
  return node.childIds.map((id) => tree.nodes[id]).filter(Boolean)
}

/** Get the path from root to a specific node */
export const getPathToNode = (
  tree: QuestionTree,
  nodeId: string
): QuestionNode[] => {
  const path: QuestionNode[] = []
  let current = tree.nodes[nodeId]
  
  while (current) {
    path.unshift(current)
    current = current.parentId ? tree.nodes[current.parentId] : null
  }
  
  return path
}

/** Get depth of a node in the tree */
export const getNodeDepth = (
  tree: QuestionTree,
  nodeId: string
): number => {
  let depth = 0
  let current = tree.nodes[nodeId]
  
  while (current?.parentId) {
    depth++
    current = tree.nodes[current.parentId]
  }
  
  return depth
}
