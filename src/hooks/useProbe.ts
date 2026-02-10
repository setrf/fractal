/**
 * @fileoverview Custom hook for managing the Probe feature.
 *
 * Provides state management, localStorage persistence, and CRUD operations
 * for Probes - synthesis-focused conversations that combine Stash items.
 *
 * Features:
 * - Automatic localStorage persistence with debouncing
 * - CRUD operations (create, delete, rename, update)
 * - Message management (add user/assistant messages)
 * - Stash item selection for each probe
 * - Prompt synthesis from selected items
 * - Sidebar visibility and width management
 *
 * @example
 * ```typescript
 * const {
 *   probes,
 *   activeProbe,
 *   createProbe,
 *   sendMessage,
 *   selectStashItems
 * } = useProbe()
 *
 * // Create a new probe
 * const newProbe = createProbe()
 *
 * // Select stash items for the probe
 * selectStashItems(newProbe.id, ['s_123', 's_456'])
 * ```
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import {
  type Probe,
  type ProbeMessage,
  generateProbeId,
  generateProbeMessageId,
  isValidProbe,
  getNextAvailableColor,
  createDefaultProbeName,
  PROBE_STORAGE_KEY,
  MAX_PROBES,
} from '../types/probe'
import type { StashItem } from '../types/stash'

/**
 * Debounce delay for localStorage saves (in milliseconds).
 * Prevents excessive writes during rapid updates.
 */
const SAVE_DEBOUNCE_MS = 500

/**
 * Return type for the useProbe hook.
 */
export interface UseProbeReturn {
  /** All probes, sorted by creation date (newest first) */
  probes: Probe[]

  /** Currently active probe (selected tab) */
  activeProbe: Probe | null

  /** ID of the active probe */
  activeProbeId: string | null

  /** Set the active probe by ID */
  setActiveProbeId: (id: string | null) => void

  /** Create a new probe with auto-generated name and color */
  createProbe: () => Probe | null

  /** Delete a probe by ID */
  deleteProbe: (id: string) => void

  /** Rename a probe */
  renameProbe: (id: string, name: string) => void

  /** Add a message to a probe's conversation */
  addMessage: (probeId: string, message: Omit<ProbeMessage, 'id' | 'timestamp'>) => void

  /** Update the last message (for streaming responses) */
  updateLastMessage: (probeId: string, content: string) => void

  /** Select stash items for a probe */
  selectStashItems: (probeId: string, itemIds: string[]) => void

  /** Add a single stash item to a probe's selection */
  addStashItemToProbe: (probeId: string, itemId: string) => void

  /** Remove a stash item from a probe's selection */
  removeStashItemFromProbe: (probeId: string, itemId: string) => void

  /** Toggle a stash item's selection for a probe */
  toggleStashItemForProbe: (probeId: string, itemId: string) => void

  /** Check if a stash item is selected for a probe */
  isStashItemSelectedForProbe: (probeId: string, itemId: string) => boolean

  /** Get all probes that have a stash item selected */
  getProbesForStashItem: (itemId: string) => Probe[]

  /** Synthesize a prompt from selected stash items */
  synthesizePrompt: (probeId: string, stashItems: StashItem[], userDirection?: string) => string

  /** Clear all messages from a probe */
  clearMessages: (probeId: string) => void

  /** Whether the sidebar is open */
  isOpen: boolean

  /** Toggle sidebar visibility */
  toggleOpen: () => void

  /** Set sidebar visibility explicitly */
  setIsOpen: (open: boolean) => void

  /** Current width of the sidebar (when open) */
  sidebarWidth: number

  /** Set sidebar width (for resize) */
  setSidebarWidth: (width: number) => void

  /** Whether an external element is being dragged over the probe area */
  externalDragHover: boolean

  /** Set external drag hover state */
  setExternalDragHover: (hovering: boolean) => void

  /** Number of probes */
  count: number

  /** Whether more probes can be created */
  canCreateProbe: boolean
}

/**
 * Loads probes from localStorage.
 *
 * @returns Array of valid probes, or empty array if none
 */
const loadFromStorage = (): Probe[] => {
  try {
    const stored = localStorage.getItem(PROBE_STORAGE_KEY)
    if (!stored) return []

    const parsed = JSON.parse(stored)
    if (!Array.isArray(parsed)) return []

    // Validate each probe
    return parsed.filter(isValidProbe)
  } catch (error) {
    console.error('[useProbe] Failed to load from localStorage:', error)
    return []
  }
}

/**
 * Saves probes to localStorage.
 *
 * @param probes - Probes to save
 */
const saveToStorage = (probes: Probe[]): void => {
  try {
    localStorage.setItem(PROBE_STORAGE_KEY, JSON.stringify(probes))
  } catch (error) {
    console.error('[useProbe] Failed to save to localStorage:', error)
  }
}

/**
 * Custom hook for managing the Probe feature.
 *
 * Provides complete state management for probes including:
 * - CRUD operations with automatic persistence
 * - Message management
 * - Stash item selection
 * - Prompt synthesis
 * - Sidebar visibility toggle
 *
 * @returns Probe state and operations
 */
export function useProbe(): UseProbeReturn {
  // Core state - probes array
  const [probes, setProbes] = useState<Probe[]>(() => loadFromStorage())

  // Active probe
  const [activeProbeId, setActiveProbeId] = useState<string | null>(() => {
    const loaded = loadFromStorage()
    return loaded.length > 0 ? loaded[0].id : null
  })

  // UI state
  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window !== 'undefined' && window.innerWidth <= 768) return false
    return false // Already false in useProbe, but let's be explicit and consistent
  })
  const [sidebarWidth, setSidebarWidth] = useState(400) // Slightly wider than stash
  const [externalDragHover, setExternalDragHover] = useState(false)

  // Debounce timer ref
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Save to localStorage with debouncing
  useEffect(() => {
    // Clear any pending save
    clearTimeout(saveTimerRef.current as ReturnType<typeof setTimeout>)

    // Schedule new save
    saveTimerRef.current = setTimeout(() => {
      saveToStorage(probes)
    }, SAVE_DEBOUNCE_MS)

    // Cleanup on unmount
    return () => {
      clearTimeout(saveTimerRef.current as ReturnType<typeof setTimeout>)
    }
  }, [probes])

  // Get active probe
  const activeProbe = probes.find(p => p.id === activeProbeId) || null

  /**
   * Create a new probe with auto-generated name and color.
   * Returns null if max probes reached.
   */
  const createProbe = useCallback((): Probe | null => {
    const nextColor = getNextAvailableColor(probes)
    if (!nextColor) {
      console.log('[useProbe] Cannot create probe: max probes reached')
      return null
    }

    const newProbe: Probe = {
      id: generateProbeId(),
      name: createDefaultProbeName(nextColor, probes),
      color: nextColor,
      messages: [],
      selectedStashItemIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    setProbes(prev => [newProbe, ...prev])
    setActiveProbeId(newProbe.id)

    console.log(`[useProbe] Created probe: ${newProbe.name} (${newProbe.color})`)
    return newProbe
  }, [probes])

  /**
   * Delete a probe by ID.
   */
  const deleteProbe = useCallback((id: string): void => {
    setProbes(prev => {
      const probe = prev.find(p => p.id === id)
      if (probe) {
        console.log(`[useProbe] Deleted probe: ${probe.name}`)
      }
      const updated = prev.filter(p => p.id !== id)

      // If deleted probe was active, switch to first available
      if (activeProbeId === id) {
        setActiveProbeId(updated.length > 0 ? updated[0].id : null)
      }

      return updated
    })
  }, [activeProbeId])

  /**
   * Rename a probe.
   */
  const renameProbe = useCallback((id: string, name: string): void => {
    setProbes(prev =>
      prev.map(probe =>
        probe.id === id
          ? { ...probe, name, updatedAt: Date.now() }
          : probe
      )
    )
  }, [])

  /**
   * Add a message to a probe's conversation.
   */
  const addMessage = useCallback(
    (probeId: string, message: Omit<ProbeMessage, 'id' | 'timestamp'>): void => {
      const newMessage: ProbeMessage = {
        ...message,
        id: generateProbeMessageId(),
        timestamp: Date.now(),
      }

      setProbes(prev =>
        prev.map(probe =>
          probe.id === probeId
            ? {
                ...probe,
                messages: [...probe.messages, newMessage],
                updatedAt: Date.now(),
              }
            : probe
        )
      )
    },
    []
  )

  /**
   * Update the last message (for streaming responses).
   */
  const updateLastMessage = useCallback((probeId: string, content: string): void => {
    setProbes(prev =>
      prev.map(probe => {
        if (probe.id !== probeId || probe.messages.length === 0) return probe

        const messages = [...probe.messages]
        const lastIndex = messages.length - 1
        messages[lastIndex] = { ...messages[lastIndex], content }

        return { ...probe, messages, updatedAt: Date.now() }
      })
    )
  }, [])

  /**
   * Select stash items for a probe (replaces existing selection).
   */
  const selectStashItems = useCallback((probeId: string, itemIds: string[]): void => {
    setProbes(prev =>
      prev.map(probe =>
        probe.id === probeId
          ? { ...probe, selectedStashItemIds: itemIds, updatedAt: Date.now() }
          : probe
      )
    )
  }, [])

  /**
   * Add a single stash item to a probe's selection.
   */
  const addStashItemToProbe = useCallback((probeId: string, itemId: string): void => {
    setProbes(prev =>
      prev.map(probe => {
        if (probe.id !== probeId) return probe
        if (probe.selectedStashItemIds.includes(itemId)) return probe

        return {
          ...probe,
          selectedStashItemIds: [...probe.selectedStashItemIds, itemId],
          updatedAt: Date.now(),
        }
      })
    )
  }, [])

  /**
   * Remove a stash item from a probe's selection.
   */
  const removeStashItemFromProbe = useCallback((probeId: string, itemId: string): void => {
    setProbes(prev =>
      prev.map(probe => {
        if (probe.id !== probeId) return probe

        return {
          ...probe,
          selectedStashItemIds: probe.selectedStashItemIds.filter(id => id !== itemId),
          updatedAt: Date.now(),
        }
      })
    )
  }, [])

  /**
   * Toggle a stash item's selection for a probe.
   */
  const toggleStashItemForProbe = useCallback((probeId: string, itemId: string): void => {
    setProbes(prev =>
      prev.map(probe => {
        if (probe.id !== probeId) return probe

        const isSelected = probe.selectedStashItemIds.includes(itemId)
        return {
          ...probe,
          selectedStashItemIds: isSelected
            ? probe.selectedStashItemIds.filter(id => id !== itemId)
            : [...probe.selectedStashItemIds, itemId],
          updatedAt: Date.now(),
        }
      })
    )
  }, [])

  /**
   * Check if a stash item is selected for a probe.
   */
  const isStashItemSelectedForProbe = useCallback(
    (probeId: string, itemId: string): boolean => {
      const probe = probes.find(p => p.id === probeId)
      return probe?.selectedStashItemIds.includes(itemId) ?? false
    },
    [probes]
  )

  /**
   * Get all probes that have a stash item selected.
   */
  const getProbesForStashItem = useCallback(
    (itemId: string): Probe[] => {
      return probes.filter(probe => probe.selectedStashItemIds.includes(itemId))
    },
    [probes]
  )

  /**
   * Synthesize a prompt from selected stash items.
   * Groups items by type and formats them into a structured prompt.
   */
  const synthesizePrompt = useCallback(
    (probeId: string, stashItems: StashItem[], userDirection?: string): string => {
      const probe = probes.find(p => p.id === probeId)
      if (!probe) return userDirection || ''

      // Get selected items from the stash
      const selectedItems = stashItems.filter(item =>
        probe.selectedStashItemIds.includes(item.id)
      )

      if (selectedItems.length === 0) {
        return userDirection || ''
      }

      // Group items by type
      const highlights = selectedItems.filter(i => i.type === 'highlight')
      const explanations = selectedItems.filter(i => i.type === 'explanation')
      const questions = selectedItems.filter(i => i.type === 'question')
      const notes = selectedItems.filter(i => i.type === 'note')
      const chatMessages = selectedItems.filter(i => i.type === 'chat-message')

      // Build the synthesized prompt
      const sections: string[] = []

      sections.push('## Context from your exploration:\n')

      if (highlights.length > 0) {
        sections.push('### Key Concepts')
        highlights.forEach(item => {
          const source = item.metadata.sourceQuestion
            ? ` (from: "${item.metadata.sourceQuestion}")`
            : ''
          sections.push(`- **${item.content}**${source}`)
        })
        sections.push('')
      }

      if (explanations.length > 0) {
        sections.push('### Explanations')
        explanations.forEach(item => {
          const summary = item.metadata.summary || item.content
          sections.push(`- **${item.content}**: ${summary}`)
        })
        sections.push('')
      }

      if (questions.length > 0) {
        sections.push('### Questions Explored')
        questions.forEach(item => {
          sections.push(`- ${item.content}`)
        })
        sections.push('')
      }

      if (notes.length > 0) {
        sections.push('### Your Notes')
        notes.forEach(item => {
          const title = item.metadata.title ? `**${item.metadata.title}**: ` : ''
          sections.push(`- ${title}${item.content}`)
        })
        sections.push('')
      }

      if (chatMessages.length > 0) {
        sections.push('### Relevant Chat Excerpts')
        chatMessages.forEach(item => {
          const role = item.metadata.role === 'assistant' ? 'AI' : 'You'
          sections.push(`- [${role}]: "${item.content.slice(0, 200)}${item.content.length > 200 ? '...' : ''}"`)
        })
        sections.push('')
      }

      sections.push('---\n')
      sections.push('## Your Direction:')
      sections.push(userDirection || '[Enter your question or direction here]')

      return sections.join('\n')
    },
    [probes]
  )

  /**
   * Clear all messages from a probe.
   */
  const clearMessages = useCallback((probeId: string): void => {
    setProbes(prev =>
      prev.map(probe =>
        probe.id === probeId
          ? { ...probe, messages: [], updatedAt: Date.now() }
          : probe
      )
    )
  }, [])

  /**
   * Toggle sidebar visibility.
   */
  const toggleOpen = useCallback((): void => {
    setIsOpen(prev => !prev)
  }, [])

  return {
    probes,
    activeProbe,
    activeProbeId,
    setActiveProbeId,
    createProbe,
    deleteProbe,
    renameProbe,
    addMessage,
    updateLastMessage,
    selectStashItems,
    addStashItemToProbe,
    removeStashItemFromProbe,
    toggleStashItemForProbe,
    isStashItemSelectedForProbe,
    getProbesForStashItem,
    synthesizePrompt,
    clearMessages,
    isOpen,
    toggleOpen,
    setIsOpen,
    sidebarWidth,
    setSidebarWidth,
    externalDragHover,
    setExternalDragHover,
    count: probes.length,
    canCreateProbe: probes.length < MAX_PROBES,
  }
}
