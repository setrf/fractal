import { useCallback, useState } from 'react'
import type { GraphNode } from '../types/graph'

interface UseGraphInteractionsInput {
  onDeepDive: (nodeId: string, question: string) => void
  onChat: (nodeId: string, question: string) => void
}

export interface UseGraphInteractionsReturn {
  graphPopupNode: GraphNode | null
  graphPopupPosition: { x: number; y: number }
  handleGraphNodeClick: (node: GraphNode, event: MouseEvent) => void
  handleGraphPopupClose: () => void
  handleGraphDeepDive: (nodeId: string, question: string) => void
  handleGraphChat: (nodeId: string, question: string) => void
}

/**
 * Encapsulates Graph view popup behavior and actions.
 */
export function useGraphInteractions({
  onDeepDive,
  onChat,
}: UseGraphInteractionsInput): UseGraphInteractionsReturn {
  const [graphPopupNode, setGraphPopupNode] = useState<GraphNode | null>(null)
  const [graphPopupPosition, setGraphPopupPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 })

  const handleGraphNodeClick = useCallback((node: GraphNode, event: MouseEvent) => {
    setGraphPopupNode(node)
    setGraphPopupPosition({ x: event.clientX, y: event.clientY })
  }, [])

  const handleGraphPopupClose = useCallback(() => {
    setGraphPopupNode(null)
  }, [])

  const handleGraphDeepDive = useCallback((nodeId: string, question: string) => {
    handleGraphPopupClose()
    onDeepDive(nodeId, question)
  }, [handleGraphPopupClose, onDeepDive])

  const handleGraphChat = useCallback((nodeId: string, question: string) => {
    handleGraphPopupClose()
    onChat(nodeId, question)
  }, [handleGraphPopupClose, onChat])

  return {
    graphPopupNode,
    graphPopupPosition,
    handleGraphNodeClick,
    handleGraphPopupClose,
    handleGraphDeepDive,
    handleGraphChat,
  }
}
