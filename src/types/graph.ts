/**
 * @fileoverview Types for the 3D Knowledge Graph visualization.
 *
 * The graph system provides an alternative view of the Fractal exploration,
 * displaying all entities (Questions, Concepts, Stash Items, Probes) as
 * interconnected nodes in a 3D force-directed graph.
 *
 * Nodes cluster based on their relationships, creating natural groupings
 * that reflect the user's exploration journey.
 *
 * @example
 * ```typescript
 * // Example of a question node in the graph
 * const questionNode: GraphNode = {
 *   id: 'q_1706745600000_abc123',
 *   type: 'question',
 *   label: 'What is consciousness?',
 *   data: questionNodeData,
 *   color: 'oklch(65% 0.15 250)',
 *   size: 1.0,
 *   group: 'q_1706745600000_abc123'
 * }
 * ```
 */

import type { QuestionNode } from './question'
import type { ExtractedConcept } from './concept'
import type { StashItem } from './stash'
import type { Probe } from './probe'

/**
 * Types of nodes that can appear in the graph.
 */
export type GraphNodeType = 'question' | 'concept' | 'stash' | 'probe'

/**
 * Types of edges/links between nodes.
 */
export type GraphEdgeType =
  | 'question-child'      // Question to child question (tree structure)
  | 'question-concept'    // Question contains/mentions concept
  | 'concept-related'     // Related concepts (from explanation)
  | 'stash-source'        // Stash item sourced from a question/concept
  | 'probe-stash'         // Probe uses stash item as context

/**
 * Represents a node in the 3D graph visualization.
 *
 * Each node contains a reference to its original data entity,
 * along with visual properties for rendering.
 */
export interface GraphNode {
  /**
   * Unique identifier - matches the original entity ID.
   */
  id: string

  /**
   * Type of entity this node represents.
   */
  type: GraphNodeType

  /**
   * Display label for the node.
   * Truncated version of content for readability.
   */
  label: string

  /**
   * Reference to the original entity data.
   * Used for popups and detailed views.
   */
  data: QuestionNode | ExtractedConcept | StashItem | Probe

  /**
   * Color for rendering the node.
   * Should be a valid CSS color (OKLCH preferred).
   */
  color: string

  /**
   * Size factor for the node (1.0 = base size).
   * Used to visually emphasize important nodes.
   */
  size: number

  /**
   * Cluster group identifier.
   * Nodes with the same group cluster together in 3D space.
   * Typically the ID of the most connected root question.
   */
  group: string

  /**
   * Optional: 3D position coordinates.
   * Set by the force simulation.
   */
  x?: number
  y?: number
  z?: number

  /**
   * Optional: Velocity for physics simulation.
   */
  vx?: number
  vy?: number
  vz?: number
}

/**
 * Represents an edge/link between two nodes.
 */
export interface GraphEdge {
  /**
   * ID of the source node.
   */
  source: string

  /**
   * ID of the target node.
   */
  target: string

  /**
   * Type of relationship this edge represents.
   */
  type: GraphEdgeType

  /**
   * Force strength for clustering.
   * Higher values bring connected nodes closer together.
   * Range: 0.0 to 1.0
   */
  strength: number

  /**
   * Optional: Visual width of the edge.
   */
  width?: number

  /**
   * Optional: Color for rendering the edge.
   */
  color?: string
}

/**
 * Complete graph data structure for visualization.
 */
export interface GraphData {
  /**
   * All nodes in the graph.
   */
  nodes: GraphNode[]

  /**
   * All edges/links in the graph.
   */
  edges: GraphEdge[]
}

/**
 * Configuration for graph node visibility filters.
 */
export interface GraphFilters {
  showQuestions: boolean
  showConcepts: boolean
  showStashItems: boolean
  showProbes: boolean
}

/**
 * Default filter configuration (all visible).
 */
export const DEFAULT_GRAPH_FILTERS: GraphFilters = {
  showQuestions: true,
  showConcepts: true,
  showStashItems: true,
  showProbes: true,
}

/**
 * localStorage key for persisting graph view settings.
 */
export const GRAPH_VIEW_STORAGE_KEY = 'fractal-view-mode'

/**
 * View mode options for the main content area.
 */
export type ViewMode = 'traditional' | 'graph'

/**
 * Default view mode.
 */
export const DEFAULT_VIEW_MODE: ViewMode = 'traditional'

/**
 * Generates a unique identifier for graph elements.
 *
 * @param prefix - Prefix for the ID ('gn' for node, 'ge' for edge)
 * @returns A unique string ID
 */
export const generateGraphId = (prefix: 'gn' | 'ge'): string => {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

/**
 * Truncates a string for use as a node label.
 *
 * @param text - The text to truncate
 * @param maxLength - Maximum length (default 50)
 * @returns Truncated text with ellipsis if needed
 */
export const truncateLabel = (text: string, maxLength: number = 50): string => {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength - 3) + '...'
}

/**
 * Size multipliers for different node types.
 */
export const NODE_SIZE_MULTIPLIERS: Record<GraphNodeType, number> = {
  question: 1.0,
  concept: 0.5,
  stash: 0.4,
  probe: 0.7,
}

/**
 * Edge widths for different relationship types.
 */
export const EDGE_WIDTHS: Record<GraphEdgeType, number> = {
  'question-child': 2,
  'question-concept': 1,
  'concept-related': 0.5,
  'stash-source': 1,
  'probe-stash': 1.5,
}

/**
 * Edge force strengths for clustering.
 */
export const EDGE_STRENGTHS: Record<GraphEdgeType, number> = {
  'question-child': 1.0,
  'question-concept': 0.8,
  'concept-related': 0.3,
  'stash-source': 0.6,
  'probe-stash': 0.7,
}

/**
 * Human-readable labels for node types.
 */
export const nodeTypeLabels: Record<GraphNodeType, string> = {
  question: 'Question',
  concept: 'Concept',
  stash: 'Stash Item',
  probe: 'Probe',
}

/**
 * Human-readable labels for edge types.
 */
export const edgeTypeLabels: Record<GraphEdgeType, string> = {
  'question-child': 'Child Question',
  'question-concept': 'Contains Concept',
  'concept-related': 'Related Concept',
  'stash-source': 'From Source',
  'probe-stash': 'Uses Item',
}

/**
 * Validates that a view mode is valid.
 *
 * @param mode - The mode to validate
 * @returns True if valid
 */
export const isValidViewMode = (mode: unknown): mode is ViewMode => {
  return mode === 'traditional' || mode === 'graph'
}
