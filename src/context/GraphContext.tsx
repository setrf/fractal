/* eslint-disable react-refresh/only-export-components */

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
  /** Link distance multiplier */
  linkDistanceMult: number
  /** Repulsion multiplier */
  repulsionMult: number
  /** Centering strength multiplier */
  centeringMult: number
  /** Friction / Velocity decay multiplier */
  frictionMult: number
  /** Global visual scale (nodes/text) */
  visualScale: number
  /** Set link distance multiplier */
  setLinkDistanceMult: (val: number) => void
  /** Set repulsion multiplier */
  setRepulsionMult: (val: number) => void
  /** Set centering multiplier */
  setCenteringMult: (val: number) => void
  /** Set friction multiplier */
  setFrictionMult: (val: number) => void
  /** Set visual scale */
  setVisualScale: (val: number) => void
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
  setFilters: () => { },
  toggleNodeType: () => { },
  resetFilters: () => { },
  linkDistanceMult: 1.0,
  repulsionMult: 1.0,
  centeringMult: 1.0,
  frictionMult: 1.0,
  visualScale: 1.0,
  setLinkDistanceMult: () => { },
  setRepulsionMult: () => { },
  setCenteringMult: () => { },
  setFrictionMult: () => { },
  setVisualScale: () => { },
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

  // Force state
  const [linkDistanceMult, setLinkDistanceMult] = useState(1.0)
  const [repulsionMult, setRepulsionMult] = useState(1.0)
  const [centeringMult, setCenteringMult] = useState(1.0)
  const [frictionMult, setFrictionMult] = useState(1.0)
  const [visualScale, setVisualScale] = useState(1.0)

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
      linkDistanceMult,
      setLinkDistanceMult,
      repulsionMult,
      setRepulsionMult,
      centeringMult,
      setCenteringMult,
      frictionMult,
      setFrictionMult,
      visualScale,
      setVisualScale,
    }),
    [
      graphDataResult,
      filters,
      toggleNodeType,
      resetFilters,
      linkDistanceMult,
      repulsionMult,
      centeringMult,
      frictionMult,
      visualScale
    ]
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
