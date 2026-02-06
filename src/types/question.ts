/**
 * @fileoverview Core types and utilities for the Fractal question tree system.
 * 
 * The question tree uses a normalized data structure where all nodes are stored
 * in a flat Record, indexed by their unique IDs. This enables O(1) lookups and
 * efficient immutable updates.
 * 
 * @example
 * ```typescript
 * // Create a new tree with a root question
 * let tree = createEmptyTree()
 * const rootNode = createQuestionNode("What is consciousness?")
 * tree = addNodeToTree(tree, rootNode)
 * 
 * // Add a child question
 * const childNode = createQuestionNode("Is consciousness emergent?", rootNode.id)
 * tree = addNodeToTree(tree, childNode)
 * ```
 */

/**
 * Represents a single question node in the tree.
 * 
 * Each node contains the question text, references to its parent and children,
 * positioning data for visualization, and metadata for UI state.
 */
export interface QuestionNode {
  /** 
   * Unique identifier for this question node.
   * Format: `q_${timestamp}_${randomString}`
   */
  id: string
  
  /** 
   * The question text entered by the user.
   * Should not be empty or whitespace-only.
   */
  text: string
  
  /** 
   * ID of the parent node.
   * `null` indicates this is the root node.
   */
  parentId: string | null
  
  /** 
   * Array of child node IDs.
   * Order is preserved (insertion order).
   */
  childIds: string[]
  
  /** 
   * Position coordinates for tree visualization.
   * Currently used for future zoom/pan features.
   */
  position: {
    x: number
    y: number
  }
  
  /** 
   * UI-related metadata.
   * Separating metadata from core data enables cleaner state updates.
   */
  meta: {
    /** Unix timestamp when the node was created */
    createdAt: number
    /** Whether children are visible in the tree view */
    isExpanded: boolean
    /** Whether this node is the currently focused/selected node */
    isActive: boolean
    /** Quality score for this node (AI-scored or derived) */
    qualityScore: number | null
  }
}

/**
 * The complete state of a question tree.
 * 
 * Uses a normalized structure for efficient operations:
 * - `nodes`: Flat Record for O(1) lookup by ID
 * - `rootId`: Quick access to the tree's entry point
 * - `activeId`: Tracks user focus without traversing the tree
 */
export interface QuestionTree {
  /** All nodes indexed by their unique ID for O(1) lookup */
  nodes: Record<string, QuestionNode>
  
  /** ID of the root node, or null if tree is empty */
  rootId: string | null
  
  /** ID of the currently active/focused node, or null if none */
  activeId: string | null
}

/**
 * Creates an empty question tree with no nodes.
 * 
 * Use this as the initial state before any questions are added.
 * 
 * @returns A new empty QuestionTree
 * 
 * @example
 * ```typescript
 * const [tree, setTree] = useState<QuestionTree>(createEmptyTree)
 * ```
 */
export const createEmptyTree = (): QuestionTree => ({
  nodes: {},
  rootId: null,
  activeId: null,
})

/**
 * Generates a unique identifier for a question node.
 * 
 * Format: `q_${timestamp}_${random}`
 * - Prefix 'q_' for easy identification
 * - Timestamp for rough ordering/debugging
 * - Random suffix for uniqueness
 * 
 * @returns A unique string ID
 * 
 * @example
 * ```typescript
 * const id = generateId() // "q_1706745600000_abc123"
 * ```
 */
export const generateId = (): string => {
  return `q_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

/**
 * Factory function to create a new QuestionNode.
 * 
 * Sets sensible defaults for all fields:
 * - Generates a unique ID
 * - Sets createdAt to current time
 * - Starts expanded and inactive
 * 
 * @param text - The question text
 * @param parentId - ID of parent node, or null for root
 * @param position - Optional x/y coordinates for visualization
 * @returns A new QuestionNode object
 * 
 * @example
 * ```typescript
 * // Create a root node
 * const root = createQuestionNode("Why do we dream?")
 * 
 * // Create a child node
 * const child = createQuestionNode(
 *   "What happens in REM sleep?",
 *   root.id,
 *   { x: 200, y: 0 }
 * )
 * ```
 */
export const createQuestionNode = (
  text: string,
  parentId: string | null = null,
  position: { x: number; y: number } = { x: 0, y: 0 },
  metaOverrides: Partial<QuestionNode['meta']> = {}
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
    qualityScore: null,
    ...metaOverrides,
  },
})

export interface QuestionNodeAddOptions {
  qualityScore?: number | null
}

/**
 * Adds a node to the tree immutably.
 * 
 * This function:
 * 1. Adds the new node to the nodes Record
 * 2. Updates the parent's childIds array (if parent exists)
 * 3. Sets rootId if this is a root node (parentId is null)
 * 4. Sets the new node as active
 * 
 * @param tree - The current tree state
 * @param node - The node to add
 * @returns A new QuestionTree with the node added
 * 
 * @example
 * ```typescript
 * let tree = createEmptyTree()
 * const node = createQuestionNode("What is time?")
 * tree = addNodeToTree(tree, node)
 * // tree.nodes now contains the node
 * // tree.rootId is now node.id
 * ```
 */
export const addNodeToTree = (
  tree: QuestionTree,
  node: QuestionNode
): QuestionTree => {
  // Create new nodes object with the new node
  const newNodes = { ...tree.nodes, [node.id]: node }
  
  // If the node has a parent, update the parent's childIds
  if (node.parentId && newNodes[node.parentId]) {
    newNodes[node.parentId] = {
      ...newNodes[node.parentId],
      childIds: [...newNodes[node.parentId].childIds, node.id],
    }
  }
  
  return {
    ...tree,
    nodes: newNodes,
    // Set as root if this node has no parent
    rootId: node.parentId === null ? node.id : tree.rootId,
    // New nodes become active by default
    activeId: node.id,
  }
}

/**
 * Retrieves all direct children of a node.
 * 
 * Returns an array of QuestionNode objects, not just IDs.
 * Filters out any invalid/missing child references.
 * 
 * @param tree - The tree to query
 * @param nodeId - ID of the parent node
 * @returns Array of child QuestionNodes
 * 
 * @example
 * ```typescript
 * const children = getChildren(tree, parentId)
 * children.forEach(child => console.log(child.text))
 * ```
 */
export const getChildren = (
  tree: QuestionTree,
  nodeId: string
): QuestionNode[] => {
  const node = tree.nodes[nodeId]
  if (!node) return []
  
  // Map childIds to actual nodes, filtering any that don't exist
  return node.childIds
    .map((id) => tree.nodes[id])
    .filter((child): child is QuestionNode => Boolean(child))
}

/**
 * Gets the path from the root to a specific node.
 * 
 * Traverses up the tree from the target node to the root,
 * then reverses to get root-first order.
 * 
 * Useful for breadcrumb navigation or highlighting ancestry.
 * 
 * @param tree - The tree to query
 * @param nodeId - ID of the target node
 * @returns Array of nodes from root to target (inclusive)
 * 
 * @example
 * ```typescript
 * const path = getPathToNode(tree, leafNodeId)
 * // path[0] is the root, path[path.length - 1] is the target
 * const breadcrumb = path.map(n => n.text).join(" → ")
 * ```
 */
export const getPathToNode = (
  tree: QuestionTree,
  nodeId: string
): QuestionNode[] => {
  const path: QuestionNode[] = []
  let current: QuestionNode | undefined = tree.nodes[nodeId]
  
  // Walk up the tree via parentId references
  while (current) {
    path.unshift(current) // Prepend to maintain root-first order
    current = current.parentId ? tree.nodes[current.parentId] : undefined
  }
  
  return path
}

/**
 * Calculates the depth of a node in the tree.
 * 
 * Root node has depth 0, its children have depth 1, etc.
 * 
 * @param tree - The tree to query
 * @param nodeId - ID of the node to measure
 * @returns The depth (0 for root, increases for each level)
 * 
 * @example
 * ```typescript
 * const depth = getNodeDepth(tree, nodeId)
 * const indent = depth * 24 // 24px per level
 * ```
 */
export const getNodeDepth = (
  tree: QuestionTree,
  nodeId: string
): number => {
  let depth = 0
  let current = tree.nodes[nodeId]
  
  // Count parents until we reach the root
  while (current?.parentId) {
    depth++
    current = tree.nodes[current.parentId]
  }
  
  return depth
}
