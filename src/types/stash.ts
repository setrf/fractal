/**
 * @fileoverview Types for the Stash feature - a collection system for
 * intellectual snippets gathered during exploration.
 *
 * The Stash allows users to collect and organize:
 * - Highlighted concepts from questions
 * - Concept explanations from popups
 * - Questions from the exploration tree
 * - Chat messages from conversations
 * - Custom user-written notes
 *
 * All stashed items are persisted to localStorage for cross-session access.
 *
 * @example
 * ```typescript
 * // Creating a stash item from a concept highlight
 * const item: StashItem = {
 *   id: 's_1706745600000_abc123',
 *   type: 'highlight',
 *   content: 'evolutionary',
 *   metadata: {
 *     normalizedName: 'evolution',
 *     conceptCategory: 'science'
 *   },
 *   createdAt: Date.now()
 * }
 * ```
 */

import type { ConceptCategory } from './concept'

/**
 * Types of content that can be stashed.
 * Each type has specific metadata and rendering behavior.
 */
export type StashItemType =
  | 'highlight'      // Extracted or user-created concept highlight
  | 'explanation'    // Concept explanation from popup (summary + context)
  | 'question'       // Question from the exploration tree
  | 'chat-message'   // Message from a chat conversation
  | 'note'           // User-written custom note

/**
 * Type-specific metadata for stash items.
 * Properties are optional based on the item type.
 */
export interface StashItemMetadata {
  // ============================================
  // For 'highlight' items
  // ============================================
  /** Category for color-coding the highlight */
  conceptCategory?: ConceptCategory
  /** Canonical/normalized name of the concept */
  normalizedName?: string
  /** Original question the highlight came from */
  sourceQuestion?: string

  // ============================================
  // For 'explanation' items
  // ============================================
  /** Brief standalone explanation */
  summary?: string
  /** Contextual explanation related to the question */
  context?: string
  /** Related concepts for potential exploration */
  relatedConcepts?: string[]

  // ============================================
  // For 'question' items
  // ============================================
  /** ID of the question node in the tree */
  questionId?: string
  /** Text of the parent question (for context) */
  parentQuestion?: string
  /** Depth in the question tree */
  treeDepth?: number

  // ============================================
  // For 'chat-message' items
  // ============================================
  /** Role of the message sender */
  role?: 'user' | 'assistant'
  /** The question being discussed in chat */
  questionContext?: string
  /** Position in the conversation */
  messageIndex?: number

  // ============================================
  // For 'note' items
  // ============================================
  /** Optional link to another stash item */
  linkedItemId?: string
  /** Title for the note */
  title?: string
}

/**
 * Represents a single item in the Stash.
 *
 * Each item contains the primary content, type-specific metadata,
 * and optional user-defined tags for organization.
 */
export interface StashItem {
  /**
   * Unique identifier for this stash item.
   * Format: `s_${timestamp}_${randomString}`
   */
  id: string

  /**
   * Type of content stored in this item.
   * Determines rendering style and available actions.
   */
  type: StashItemType

  /**
   * Primary text content of the stashed item.
   * For explanations, this is the concept name.
   * For questions, this is the question text.
   */
  content: string

  /**
   * Type-specific metadata.
   * See StashItemMetadata for available properties per type.
   */
  metadata: StashItemMetadata

  /**
   * Unix timestamp when the item was stashed.
   * Used for sorting and display.
   */
  createdAt: number

  /**
   * Optional user-defined tags for organization.
   * Can be used for filtering and grouping.
   */
  tags?: string[]

  /**
   * IDs of Probes this item is assigned to.
   * Used for visual indicators and selection state.
   * An item can be assigned to multiple Probes.
   */
  assignedProbeIds?: string[]
}

/**
 * Input type for creating a new stash item.
 * ID and createdAt are generated automatically.
 */
export type StashItemInput = Omit<StashItem, 'id' | 'createdAt'>

/**
 * Generates a unique identifier for a stash item.
 *
 * Format: `s_${timestamp}_${random}`
 * - Prefix 's_' for easy identification (vs 'q_' for questions, 'c_' for concepts)
 * - Timestamp for ordering
 * - Random suffix for uniqueness
 *
 * @returns A unique string ID
 *
 * @example
 * ```typescript
 * const id = generateStashId() // "s_1706745600000_abc123"
 * ```
 */
export const generateStashId = (): string => {
  return `s_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

/**
 * Human-readable labels for stash item types.
 * Used in the UI for filtering and display.
 */
export const stashTypeLabels: Record<StashItemType, string> = {
  highlight: 'Highlight',
  explanation: 'Explanation',
  question: 'Question',
  'chat-message': 'Chat Message',
  note: 'Note',
}

/**
 * Icons for each stash item type.
 * Used in the UI for visual differentiation.
 */
export const stashTypeIcons: Record<StashItemType, string> = {
  highlight: '✦',        // Sparkle for highlights
  explanation: '💡',     // Lightbulb for explanations
  question: '?',         // Question mark
  'chat-message': '💬',  // Speech bubble
  note: '📝',            // Memo for notes
}

/**
 * CSS variable names for stash item type colors.
 * Maps to design tokens in tokens.css.
 */
export const stashTypeColorVar: Record<StashItemType, string> = {
  highlight: '--stash-highlight',
  explanation: '--stash-explanation',
  question: '--stash-question',
  'chat-message': '--stash-chat',
  note: '--stash-note',
}

/**
 * localStorage key for persisting the stash.
 */
export const STASH_STORAGE_KEY = 'fractal-stash'

/**
 * Maximum number of items allowed in the stash.
 * Prevents localStorage from growing too large.
 */
export const STASH_MAX_ITEMS = 500

/**
 * Validates a stash item has required fields.
 *
 * @param item - The item to validate
 * @returns True if the item is valid
 */
export const isValidStashItem = (item: unknown): item is StashItem => {
  if (!item || typeof item !== 'object') return false
  const obj = item as Record<string, unknown>
  const validTypes: StashItemType[] = ['highlight', 'explanation', 'question', 'chat-message', 'note']
  const validCategories: ConceptCategory[] = ['science', 'philosophy', 'psychology', 'technology', 'abstract']
  const isStringArray = (value: unknown): value is string[] => (
    Array.isArray(value) && value.every(itemValue => typeof itemValue === 'string')
  )

  if (obj.tags !== undefined && !isStringArray(obj.tags)) return false
  if (obj.assignedProbeIds !== undefined && !isStringArray(obj.assignedProbeIds)) return false

  const hasCoreFields = (
    typeof obj.id === 'string' &&
    typeof obj.type === 'string' &&
    validTypes.includes(obj.type as StashItemType) &&
    typeof obj.content === 'string' &&
    typeof obj.createdAt === 'number' &&
    typeof obj.metadata === 'object' &&
    obj.metadata !== null &&
    !Array.isArray(obj.metadata)
  )
  if (!hasCoreFields) return false

  const metadata = obj.metadata as Record<string, unknown>
  if (metadata.relatedConcepts !== undefined && !isStringArray(metadata.relatedConcepts)) return false
  if (metadata.conceptCategory !== undefined && !validCategories.includes(metadata.conceptCategory as ConceptCategory)) return false
  if (metadata.role !== undefined && metadata.role !== 'user' && metadata.role !== 'assistant') return false
  if (metadata.messageIndex !== undefined && typeof metadata.messageIndex !== 'number') return false
  if (metadata.treeDepth !== undefined && typeof metadata.treeDepth !== 'number') return false
  if (metadata.questionId !== undefined && typeof metadata.questionId !== 'string') return false
  if (metadata.parentQuestion !== undefined && typeof metadata.parentQuestion !== 'string') return false
  if (metadata.sourceQuestion !== undefined && typeof metadata.sourceQuestion !== 'string') return false
  if (metadata.normalizedName !== undefined && typeof metadata.normalizedName !== 'string') return false
  if (metadata.summary !== undefined && typeof metadata.summary !== 'string') return false
  if (metadata.context !== undefined && typeof metadata.context !== 'string') return false
  if (metadata.questionContext !== undefined && typeof metadata.questionContext !== 'string') return false
  if (metadata.linkedItemId !== undefined && typeof metadata.linkedItemId !== 'string') return false
  if (metadata.title !== undefined && typeof metadata.title !== 'string') return false

  return true
}

/**
 * Sorts stash items by creation time (newest first).
 *
 * @param items - Array of stash items
 * @returns New array sorted by createdAt descending
 */
export const sortStashByDate = (items: StashItem[]): StashItem[] => {
  return [...items].sort((a, b) => b.createdAt - a.createdAt)
}

/**
 * Filters stash items by type.
 *
 * @param items - Array of stash items
 * @param type - Type to filter by
 * @returns Filtered array
 */
export const filterStashByType = (
  items: StashItem[],
  type: StashItemType
): StashItem[] => {
  return items.filter(item => item.type === type)
}

/**
 * Searches stash items by content.
 *
 * @param items - Array of stash items
 * @param query - Search query (case-insensitive)
 * @returns Matching items
 */
export const searchStash = (
  items: StashItem[],
  query: string
): StashItem[] => {
  const lowerQuery = query.toLowerCase()
  return items.filter(item =>
    item.content.toLowerCase().includes(lowerQuery) ||
    item.metadata.normalizedName?.toLowerCase().includes(lowerQuery) ||
    item.metadata.title?.toLowerCase().includes(lowerQuery) ||
    item.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
  )
}
