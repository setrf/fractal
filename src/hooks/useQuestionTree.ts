import { useState, useCallback } from 'react'
import {
  QuestionTree,
  QuestionNode,
  createEmptyTree,
  createQuestionNode,
  addNodeToTree,
  getChildren,
} from '../types/question'

export function useQuestionTree() {
  const [tree, setTree] = useState<QuestionTree>(createEmptyTree)

  const addRootQuestion = useCallback((text: string) => {
    const node = createQuestionNode(text, null, { x: 0, y: 0 })
    setTree((prevTree) => addNodeToTree(prevTree, node))
    return node.id
  }, [])

  const addChildQuestion = useCallback((parentId: string, text: string) => {
    setTree((prevTree) => {
      const parent = prevTree.nodes[parentId]
      if (!parent) return prevTree

      // Calculate position based on siblings
      const siblings = getChildren(prevTree, parentId)
      const yOffset = siblings.length * 60

      const node = createQuestionNode(text, parentId, {
        x: parent.position.x + 200,
        y: parent.position.y + yOffset,
      })

      return addNodeToTree(prevTree, node)
    })
  }, [])

  const setActiveNode = useCallback((nodeId: string | null) => {
    setTree((prevTree) => ({
      ...prevTree,
      activeId: nodeId,
      nodes: Object.fromEntries(
        Object.entries(prevTree.nodes).map(([id, node]) => [
          id,
          { ...node, meta: { ...node.meta, isActive: id === nodeId } },
        ])
      ),
    }))
  }, [])

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

  const reset = useCallback(() => {
    setTree(createEmptyTree())
  }, [])

  const getNode = useCallback(
    (nodeId: string): QuestionNode | undefined => tree.nodes[nodeId],
    [tree.nodes]
  )

  const getChildNodes = useCallback(
    (nodeId: string): QuestionNode[] => getChildren(tree, nodeId),
    [tree]
  )

  return {
    tree,
    rootNode: tree.rootId ? tree.nodes[tree.rootId] : null,
    activeNode: tree.activeId ? tree.nodes[tree.activeId] : null,
    addRootQuestion,
    addChildQuestion,
    setActiveNode,
    toggleNodeExpansion,
    getNode,
    getChildNodes,
    reset,
  }
}
