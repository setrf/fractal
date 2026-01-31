/**
 * @fileoverview React hook for managing the question tree state.
 * 
 * This hook encapsulates all tree operations, providing a clean API for:
 * - Adding root and child questions
 * - Managing active/focused state
 * - Toggling node expansion
 * - Querying the tree
 * 
 * All operations are immutable - the tree state is never mutated directly.
 * 
 * @example
 * ```tsx
 * function App() {
 *   const { tree, addRootQuestion, addChildQuestion } = useQuestionTree()
 *   
 *   return (
 *     <div>
 *       <input onSubmit={(q) => addRootQuestion(q)} />
 *       <QuestionTree tree={tree} onAddChild={addChildQuestion} />
 *     </div>
 *   )
 * }
 * ```
 */

import { useState, useCallback } from 'react'
import {
  QuestionTree,
  QuestionNode,
  createEmptyTree,
  createQuestionNode,
  addNodeToTree,
  getChildren,
} from '../types/question'

/**
 * Hook for managing question tree state and operations.
 * 
 * Provides all the functions needed to build and navigate the question tree.
 * State is managed internally and exposed via return values.
 * 
 * @returns Object containing tree state and mutation functions
 */
export function useQuestionTree() {
  // Initialize with an empty tree
  const [tree, setTree] = useState<QuestionTree>(createEmptyTree)

  /**
   * Adds the root question to start a new exploration.
   * 
   * The root node is positioned at origin (0, 0) and becomes
   * the entry point for the entire tree.
   * 
   * @param text - The question text to use as root
   * @returns The ID of the newly created root node
   * 
   * @example
   * ```typescript
   * const rootId = addRootQuestion("What is the meaning of life?")
   * ```
   */
  const addRootQuestion = useCallback((text: string) => {
    const node = createQuestionNode(text, null, { x: 0, y: 0 })
    setTree((prevTree) => addNodeToTree(prevTree, node))
    return node.id
  }, [])

  /**
   * Adds a child question branching from an existing node.
   * 
   * Calculates position based on the number of existing siblings
   * to prevent overlap in visualization.
   * 
   * @param parentId - ID of the parent node to branch from
   * @param text - The question text for the new child
   * 
   * @example
   * ```typescript
   * addChildQuestion(parentId, "What about consciousness?")
   * ```
   */
  const addChildQuestion = useCallback((parentId: string, text: string) => {
    setTree((prevTree) => {
      const parent = prevTree.nodes[parentId]
      if (!parent) return prevTree

      // Calculate vertical offset based on sibling count
      // This creates a staggered layout for children
      const siblings = getChildren(prevTree, parentId)
      const yOffset = siblings.length * 60 // 60px between siblings

      const node = createQuestionNode(text, parentId, {
        x: parent.position.x + 200, // Offset right from parent
        y: parent.position.y + yOffset,
      })

      return addNodeToTree(prevTree, node)
    })
  }, [])

  /**
   * Sets a node as the active/focused node.
   * 
   * Updates the `isActive` meta flag on all nodes, setting it to true
   * only for the specified node. Pass null to clear active state.
   * 
   * @param nodeId - ID of the node to activate, or null to clear
   * 
   * @example
   * ```typescript
   * setActiveNode(clickedNodeId)
   * setActiveNode(null) // Clear active state
   * ```
   */
  const setActiveNode = useCallback((nodeId: string | null) => {
    setTree((prevTree) => ({
      ...prevTree,
      activeId: nodeId,
      // Update isActive flag on all nodes
      nodes: Object.fromEntries(
        Object.entries(prevTree.nodes).map(([id, node]) => [
          id,
          { ...node, meta: { ...node.meta, isActive: id === nodeId } },
        ])
      ),
    }))
  }, [])

  /**
   * Toggles whether a node's children are visible.
   * 
   * Collapsed nodes hide their children in the tree visualization,
   * helping manage complexity in large trees.
   * 
   * @param nodeId - ID of the node to toggle
   * 
   * @example
   * ```typescript
   * toggleNodeExpansion(nodeId) // Collapse if expanded, expand if collapsed
   * ```
   */
  const toggleNodeExpansion = useCallback((nodeId: string) => {
    setTree((prevTree) => {
      const node = prevTree.nodes[nodeId]
      if (!node) return prevTree

      return {
        ...prevTree,
        nodes: {
          ...prevTree.nodes,
          [nodeId]: {
            ...node,
            meta: { ...node.meta, isExpanded: !node.meta.isExpanded },
          },
        },
      }
    })
  }, [])

  /**
   * Resets the tree to its initial empty state.
   * 
   * Clears all nodes and resets rootId and activeId to null.
   * Use this to start a fresh exploration.
   * 
   * @example
   * ```typescript
   * reset() // Clear everything, start over
   * ```
   */
  const reset = useCallback(() => {
    setTree(createEmptyTree())
  }, [])

  /**
   * Retrieves a specific node by its ID.
   * 
   * @param nodeId - The ID of the node to retrieve
   * @returns The QuestionNode or undefined if not found
   */
  const getNode = useCallback(
    (nodeId: string): QuestionNode | undefined => tree.nodes[nodeId],
    [tree.nodes]
  )

  /**
   * Retrieves all children of a specific node.
   * 
   * @param nodeId - The ID of the parent node
   * @returns Array of child QuestionNodes
   */
  const getChildNodes = useCallback(
    (nodeId: string): QuestionNode[] => getChildren(tree, nodeId),
    [tree]
  )

  return {
    /** The complete tree state */
    tree,
    /** The root node, or null if tree is empty */
    rootNode: tree.rootId ? tree.nodes[tree.rootId] : null,
    /** The currently active node, or null if none */
    activeNode: tree.activeId ? tree.nodes[tree.activeId] : null,
    /** Add the initial root question */
    addRootQuestion,
    /** Add a child question to an existing node */
    addChildQuestion,
    /** Set which node is active/focused */
    setActiveNode,
    /** Toggle a node's expanded/collapsed state */
    toggleNodeExpansion,
    /** Get a specific node by ID */
    getNode,
    /** Get all children of a node */
    getChildNodes,
    /** Clear the tree and start over */
    reset,
  }
}
