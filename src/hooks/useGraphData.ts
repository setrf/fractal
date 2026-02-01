/**
 * @fileoverview Custom hook for aggregating all entity data into graph format.
 *
 * Transforms Questions, Concepts, Stash Items, and Probes into a unified
 * graph data structure suitable for 3D visualization with react-force-graph-3d.
 *
 * Features:
 * - Collects data from useQuestionTree, useStash, and useProbe
 * - Builds nodes with visual properties (color, size, group)
 * - Creates edges based on relationships between entities
 * - Supports filtering by node type
 *
 * @example
 * ```typescript
 * const { nodes, edges, isLoading } = useGraphData({
 *   tree,
 *   nodeConcepts,
 *   stashItems,
 *   probes
 * })
 * ```
 */

import { useMemo } from 'react'
import type { QuestionTree, QuestionNode } from '../types/question'
import type { ExtractedConcept, ConceptCategory } from '../types/concept'
import type { StashItem } from '../types/stash'
import type { Probe } from '../types/probe'
import {
  type GraphNode,
  type GraphEdge,
  type GraphData,
  type GraphFilters,
  type GraphNodeType,
  DEFAULT_GRAPH_FILTERS,
  NODE_SIZE_MULTIPLIERS,
  EDGE_STRENGTHS,
} from '../types/graph'
import { getNodeDepth } from '../types/question'

/**
 * Input data sources for the graph.
 */
export interface GraphDataInput {
  /** The question tree from useQuestionTree */
  tree: QuestionTree
  /** Concepts per node from App state */
  nodeConcepts: Record<string, ExtractedConcept[]>
  /** Stash items from useStash */
  stashItems: StashItem[]
  /** Probes from useProbe */
  probes: Probe[]
  /** Optional filters for node visibility */
  filters?: GraphFilters
}

/**
 * Return type for the useGraphData hook.
 */
export interface UseGraphDataReturn {
  /** All nodes in the graph */
  nodes: GraphNode[]
  /** All edges in the graph */
  edges: GraphEdge[]
  /** Combined graph data object for react-force-graph */
  graphData: GraphData
  /** Whether the graph data is being computed */
  isLoading: boolean
  /** Total count of each node type */
  counts: Record<GraphNodeType, number>
}

/**
 * Color mappings for concept categories.
 * Use hex values for Three.js compatibility.
 */
const CONCEPT_CATEGORY_COLORS: Record<ConceptCategory, string> = {
  science: '#4b7bdc',
  philosophy: '#a36ad9',
  psychology: '#d9824b',
  technology: '#4bb8c7',
  abstract: '#888888',
}

/**
 * Default colors for node types (hex for Three.js).
 */
const NODE_TYPE_COLORS: Record<GraphNodeType, string> = {
  question: '#4488dd',
  concept: '#aa66cc',      // Will be overridden by category
  stash: '#44aa88',
  probe: '#dd8844',        // Default probe color
}

/**
 * Probe colors (hex for Three.js).
 */
const PROBE_COLOR_VALUES: Record<string, string> = {
  blue: '#4488dd',
  green: '#44aa88',
  yellow: '#ddbb44',
  purple: '#aa66cc',
  orange: '#dd8844',
}

/**
 * Custom hook for generating graph data from all entity sources.
 *
 * Aggregates questions, concepts, stash items, and probes into a unified
 * graph structure with nodes and edges for 3D visualization.
 *
 * @param input - Data sources and optional filters
 * @returns Graph nodes, edges, and metadata
 */
export function useGraphData(input: GraphDataInput): UseGraphDataReturn {
  const { tree, nodeConcepts, stashItems, probes, filters = DEFAULT_GRAPH_FILTERS } = input

  // Memoize the graph data computation
  const { nodes, edges, counts } = useMemo(() => {
    const graphNodes: GraphNode[] = []
    const graphEdges: GraphEdge[] = []
    const nodeCounts: Record<GraphNodeType, number> = {
      question: 0,
      concept: 0,
      stash: 0,
      probe: 0,
    }

    // Track concept nodes by normalized name to avoid duplicates
    const conceptNodeIds = new Map<string, string>()

    // ============================================
    // 1. Process Question Nodes
    // ============================================
    if (filters.showQuestions) {
      Object.values(tree.nodes).forEach((questionNode: QuestionNode) => {
        const depth = getNodeDepth(tree, questionNode.id)
        const sizeMultiplier = Math.max(0.6, 1.0 - depth * 0.1) // Smaller nodes at deeper levels

        graphNodes.push({
          id: questionNode.id,
          type: 'question',
          label: questionNode.text,
          data: questionNode,
          color: NODE_TYPE_COLORS.question,
          size: NODE_SIZE_MULTIPLIERS.question * sizeMultiplier,
          group: tree.rootId || questionNode.id, // All questions cluster around root
        })
        nodeCounts.question++

        // Create parent-child edges
        if (questionNode.parentId) {
          graphEdges.push({
            source: questionNode.parentId,
            target: questionNode.id,
            type: 'question-child',
            strength: EDGE_STRENGTHS['question-child'],
          })
        }
      })
    }

    // ============================================
    // 2. Process Concepts
    // ============================================
    if (filters.showConcepts) {
      Object.entries(nodeConcepts).forEach(([nodeId, concepts]) => {
        concepts.forEach((concept) => {
          // Use normalized name to dedupe concepts
          const normalizedKey = concept.normalizedName.toLowerCase()

          // Only create node if we haven't seen this concept
          if (!conceptNodeIds.has(normalizedKey)) {
            const conceptId = concept.id
            conceptNodeIds.set(normalizedKey, conceptId)

            graphNodes.push({
              id: conceptId,
              type: 'concept',
              label: concept.normalizedName,
              data: concept,
              color: CONCEPT_CATEGORY_COLORS[concept.category] || NODE_TYPE_COLORS.concept,
              size: NODE_SIZE_MULTIPLIERS.concept,
              group: tree.rootId || nodeId, // Cluster with question tree
            })
            nodeCounts.concept++
          }

          // Create question-concept edge
          const conceptNodeId = conceptNodeIds.get(normalizedKey)!
          if (filters.showQuestions && tree.nodes[nodeId]) {
            graphEdges.push({
              source: nodeId,
              target: conceptNodeId,
              type: 'question-concept',
              strength: EDGE_STRENGTHS['question-concept'],
            })
          }
        })
      })
    }

    // ============================================
    // 3. Process Stash Items
    // ============================================
    if (filters.showStashItems) {
      stashItems.forEach((item) => {
        graphNodes.push({
          id: item.id,
          type: 'stash',
          label: item.content,
          data: item,
          color: NODE_TYPE_COLORS.stash,
          size: NODE_SIZE_MULTIPLIERS.stash,
          group: tree.rootId || item.id, // Cluster with question tree
        })
        nodeCounts.stash++

        // Create edges based on stash item relationships
        if (item.type === 'highlight' && item.metadata.normalizedName) {
          // Link to concept if it exists
          const conceptId = conceptNodeIds.get(item.metadata.normalizedName.toLowerCase())
          if (conceptId && filters.showConcepts) {
            graphEdges.push({
              source: conceptId,
              target: item.id,
              type: 'stash-source',
              strength: EDGE_STRENGTHS['stash-source'],
            })
          }
        }

        if (item.type === 'question' && item.metadata.questionId) {
          // Link to source question if it exists
          if (tree.nodes[item.metadata.questionId] && filters.showQuestions) {
            graphEdges.push({
              source: item.metadata.questionId,
              target: item.id,
              type: 'stash-source',
              strength: EDGE_STRENGTHS['stash-source'],
            })
          }
        }
      })
    }

    // ============================================
    // 4. Process Probes
    // ============================================
    if (filters.showProbes) {
      probes.forEach((probe) => {
        graphNodes.push({
          id: probe.id,
          type: 'probe',
          label: probe.name,
          data: probe,
          color: PROBE_COLOR_VALUES[probe.color] || NODE_TYPE_COLORS.probe,
          size: NODE_SIZE_MULTIPLIERS.probe,
          group: probe.id, // Each probe is its own cluster center
        })
        nodeCounts.probe++

        // Create edges to selected stash items
        if (filters.showStashItems) {
          probe.selectedStashItemIds.forEach((stashItemId) => {
            // Only create edge if stash item exists in our nodes
            const stashExists = stashItems.some((s) => s.id === stashItemId)
            if (stashExists) {
              graphEdges.push({
                source: probe.id,
                target: stashItemId,
                type: 'probe-stash',
                strength: EDGE_STRENGTHS['probe-stash'],
              })
            }
          })
        }
      })
    }

    return { nodes: graphNodes, edges: graphEdges, counts: nodeCounts }
  }, [tree, nodeConcepts, stashItems, probes, filters])

  // Combine into graphData format for react-force-graph
  const graphData: GraphData = useMemo(
    () => ({ nodes, edges }),
    [nodes, edges]
  )

  return {
    nodes,
    edges,
    graphData,
    isLoading: false, // Computation is synchronous via useMemo
    counts,
  }
}
