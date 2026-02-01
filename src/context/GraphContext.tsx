/**
 * @fileoverview React Context for providing graph data globally.
 *
 * The GraphContext provides access to the aggregated graph data (nodes and edges)
 * computed from all entity sources (questions, concepts, stash items, probes).
 *
 * This context is designed to be used within the AppContent component where
 * all the necessary data sources are available.
 *
 * @example
 * ```tsx
 * // In a parent component
 * <GraphProvider
 *   tree={tree}
 *   nodeConcepts={nodeConcepts}
 *   stashItems={stashItems}
 *   probes={probes}
 * >
 *   <GraphView />
 * </GraphProvider>
 *
 * // In a child component
 * const { nodes, edges, counts } = useGraphContext()
 * ```
 */

import { createContext, useContext, useState, useMemo, type ReactNode } from 'react'
import { useGraphData, type GraphDataInput, type UseGraphDataReturn } from '../hooks/useGraphData'
import { type GraphFilters, DEFAULT_GRAPH_FILTERS, type GraphNodeType } from '../types/graph'

/**
 * Extended context value including filter controls.
 */
export interface GraphContextValue extends UseGraphDataReturn {
  /** Current filter settings */
  filters: GraphFilters
  /** Update filter settings */
  setFilters: (filters: GraphFilters) => void
  /** Toggle a specific node type visibility */
  toggleNodeType: (type: GraphNodeType) => void
  /** Reset filters to default (all visible) */
  resetFilters: () => void
}

/**
 * Default context value for when context is used outside provider.
 */
const defaultContextValue: GraphContextValue = {
  nodes: [],
  edges: [],
  graphData: { nodes: [], edges: [] },
  isLoading: false,
  counts: { question: 0, concept: 0, stash: 0, probe: 0 },
  filters: DEFAULT_GRAPH_FILTERS,
  setFilters: () => {},
  toggleNodeType: () => {},
  resetFilters: () => {},
}

/**
 * React Context for graph data.
 */
const GraphContext = createContext<GraphContextValue>(defaultContextValue)

/**
 * Props for the GraphProvider component.
 */
export interface GraphProviderProps extends Omit<GraphDataInput, 'filters'> {
  children: ReactNode
}

/**
 * Provider component for graph data context.
 *
 * Wraps the useGraphData hook and provides the computed graph data
 * along with filter controls to all child components.
 */
export function GraphProvider({
  tree,
  nodeConcepts,
  stashItems,
  probes,
  children,
}: GraphProviderProps) {
  // Filter state
  const [filters, setFilters] = useState<GraphFilters>(DEFAULT_GRAPH_FILTERS)

  // Compute graph data with current filters
  const graphDataResult = useGraphData({
    tree,
    nodeConcepts,
    stashItems,
    probes,
    filters,
  })

  // Toggle a specific node type visibility
  const toggleNodeType = useMemo(
    () => (type: GraphNodeType) => {
      setFilters((prev) => {
        const key = `show${type.charAt(0).toUpperCase()}${type.slice(1)}s` as keyof GraphFilters
        // Handle special case for 'stash' -> 'showStashItems'
        const actualKey = type === 'stash' ? 'showStashItems' : key
        return { ...prev, [actualKey]: !prev[actualKey] }
      })
    },
    []
  )

  // Reset filters to default
  const resetFilters = useMemo(
    () => () => setFilters(DEFAULT_GRAPH_FILTERS),
    []
  )

  // Combine all values
  const contextValue: GraphContextValue = useMemo(
    () => ({
      ...graphDataResult,
      filters,
      setFilters,
      toggleNodeType,
      resetFilters,
    }),
    [graphDataResult, filters, toggleNodeType, resetFilters]
  )

  return (
    <GraphContext.Provider value={contextValue}>
      {children}
    </GraphContext.Provider>
  )
}

/**
 * Hook to access graph data from context.
 *
 * @throws Will log a warning if used outside of GraphProvider
 * @returns Graph data and filter controls
 */
export function useGraphContext(): GraphContextValue {
  const context = useContext(GraphContext)
  return context
}

/**
 * Re-export the context for advanced use cases.
 */
export { GraphContext }
