/**
 * @fileoverview Types for the Probe feature - a synthesis system for
 * combining collected Stash items into focused LLM conversations.
 *
 * The Probe enables users to:
 * - Select items from their Stash (highlights, explanations, questions, notes)
 * - Synthesize these into rich, contextual prompts
 * - Have focused conversations that leverage their exploration journey
 *
 * Multiple Probes can exist simultaneously, each with a distinct color
 * for visual identification. Probes persist to localStorage.
 *
 * @example
 * ```typescript
 * // Creating a new probe
 * const probe: Probe = {
 *   id: 'p_1706745600000_abc123',
 *   name: 'Consciousness Inquiry',
 *   color: 'blue',
 *   messages: [],
 *   selectedStashItemIds: ['s_123', 's_456'],
 *   createdAt: Date.now(),
 *   updatedAt: Date.now()
 * }
 * ```
 */

/**
 * Available colors for Probes.
 * Maps to chart color tokens in tokens.css.
 * Maximum 5 probes can exist (one per color).
 */
export type ProbeColor = 'blue' | 'green' | 'yellow' | 'purple' | 'orange'

/**
 * All available probe colors in order.
 * Used for auto-assignment when creating new probes.
 */
export const PROBE_COLORS: ProbeColor[] = ['blue', 'green', 'yellow', 'purple', 'orange']

/**
 * Maximum number of probes allowed.
 * Limited by the number of distinct colors.
 */
export const MAX_PROBES = 5

/**
 * Represents a single message in a Probe conversation.
 */
export interface ProbeMessage {
  /**
   * Unique identifier for this message.
   * Format: `pm_${timestamp}_${randomString}`
   */
  id: string

  /**
   * Role of the message sender.
   * - 'user': Message from the user
   * - 'assistant': Response from the LLM
   * - 'system': System context (usually hidden, used for synthesis)
   */
  role: 'user' | 'assistant' | 'system'

  /**
   * The text content of the message.
   */
  content: string

  /**
   * Unix timestamp when the message was created.
   */
  timestamp: number

  /**
   * IDs of Stash items that contributed to this message.
   * Useful for tracing which collected items informed the conversation.
   */
  sourceStashItemIds?: string[]
}

/**
 * Represents a Probe - a synthesis-focused conversation.
 *
 * Each Probe has a distinct color, can have Stash items assigned to it,
 * and maintains a conversation history with the LLM.
 */
export interface Probe {
  /**
   * Unique identifier for this probe.
   * Format: `p_${timestamp}_${randomString}`
   */
  id: string

  /**
   * User-editable name for the probe.
   * Auto-generated initially (e.g., "Probe 1", "Probe 2").
   */
  name: string

  /**
   * Distinct color for visual identification.
   * Used in tabs, badges, and border indicators.
   */
  color: ProbeColor

  /**
   * Conversation history for this probe.
   */
  messages: ProbeMessage[]

  /**
   * IDs of Stash items currently selected/assigned to this probe.
   * These items form the context for synthesized prompts.
   */
  selectedStashItemIds: string[]

  /**
   * Unix timestamp when the probe was created.
   */
  createdAt: number

  /**
   * Unix timestamp when the probe was last updated.
   */
  updatedAt: number
}

/**
 * localStorage key for persisting probes.
 */
export const PROBE_STORAGE_KEY = 'fractal-probes'

/**
 * Generates a unique identifier for a probe.
 *
 * Format: `p_${timestamp}_${random}`
 * - Prefix 'p_' for easy identification
 * - Timestamp for ordering
 * - Random suffix for uniqueness
 *
 * @returns A unique string ID
 *
 * @example
 * ```typescript
 * const id = generateProbeId() // "p_1706745600000_abc123"
 * ```
 */
export const generateProbeId = (): string => {
  return `p_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

/**
 * Generates a unique identifier for a probe message.
 *
 * Format: `pm_${timestamp}_${random}`
 *
 * @returns A unique string ID
 */
export const generateProbeMessageId = (): string => {
  return `pm_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

/**
 * CSS variable names for probe colors.
 * Maps to chart color tokens.
 */
export const probeColorVar: Record<ProbeColor, string> = {
  blue: '--chart-1',
  green: '--chart-2',
  yellow: '--chart-3',
  purple: '--chart-4',
  orange: '--chart-5',
}

/**
 * Human-readable labels for probe colors.
 */
export const probeColorLabels: Record<ProbeColor, string> = {
  blue: 'Blue',
  green: 'Green',
  yellow: 'Yellow',
  purple: 'Purple',
  orange: 'Orange',
}

/**
 * Default names for new probes based on their color.
 */
export const defaultProbeNames: Record<ProbeColor, string> = {
  blue: 'Probe Blue',
  green: 'Probe Green',
  yellow: 'Probe Yellow',
  purple: 'Probe Purple',
  orange: 'Probe Orange',
}

/**
 * Validates a probe has required fields.
 *
 * @param probe - The probe to validate
 * @returns True if the probe is valid
 */
export const isValidProbe = (probe: unknown): probe is Probe => {
  if (!probe || typeof probe !== 'object') return false
  const obj = probe as Record<string, unknown>
  return (
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    typeof obj.color === 'string' &&
    PROBE_COLORS.includes(obj.color as ProbeColor) &&
    Array.isArray(obj.messages) &&
    Array.isArray(obj.selectedStashItemIds) &&
    typeof obj.createdAt === 'number' &&
    typeof obj.updatedAt === 'number'
  )
}

/**
 * Validates a probe message has required fields.
 *
 * @param message - The message to validate
 * @returns True if the message is valid
 */
export const isValidProbeMessage = (message: unknown): message is ProbeMessage => {
  if (!message || typeof message !== 'object') return false
  const obj = message as Record<string, unknown>
  return (
    typeof obj.id === 'string' &&
    typeof obj.role === 'string' &&
    ['user', 'assistant', 'system'].includes(obj.role as string) &&
    typeof obj.content === 'string' &&
    typeof obj.timestamp === 'number'
  )
}

/**
 * Sorts probes by creation time (newest first).
 *
 * @param probes - Array of probes
 * @returns New array sorted by createdAt descending
 */
export const sortProbesByDate = (probes: Probe[]): Probe[] => {
  return [...probes].sort((a, b) => b.createdAt - a.createdAt)
}

/**
 * Gets the next available color for a new probe.
 * Returns null if all colors are in use.
 *
 * @param existingProbes - Current probes
 * @returns The next available color, or null if none available
 */
export const getNextAvailableColor = (existingProbes: Probe[]): ProbeColor | null => {
  const usedColors = new Set(existingProbes.map(p => p.color))
  for (const color of PROBE_COLORS) {
    if (!usedColors.has(color)) {
      return color
    }
  }
  return null
}

/**
 * Creates a default name for a new probe.
 *
 * @param color - The probe's color
 * @param existingProbes - Current probes (for numbering)
 * @returns A default name like "Probe 1" or "Probe Blue"
 */
export const createDefaultProbeName = (color: ProbeColor, existingProbes: Probe[]): string => {
  // Use numbered naming: "Probe 1", "Probe 2", etc.
  const number = existingProbes.length + 1
  return `Probe ${number}`
}
