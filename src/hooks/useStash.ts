/**
 * @fileoverview Custom hook for managing the Stash feature.
 *
 * Provides state management, localStorage persistence, and CRUD operations
 * for the Stash - a collection of intellectual snippets gathered during exploration.
 *
 * Features:
 * - Automatic localStorage persistence with debouncing
 * - CRUD operations (add, remove, update, clear)
 * - Filtering by type and search
 * - JSON export functionality
 * - Sidebar visibility toggle
 *
 * @example
 * ```typescript
 * const { items, addItem, removeItem, isOpen, toggleOpen } = useStash()
 *
 * // Add a highlight to the stash
 * addItem({
 *   type: 'highlight',
 *   content: 'evolution',
 *   metadata: { conceptCategory: 'science' }
 * })
 * ```
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import {
  type StashItem,
  type StashItemInput,
  type StashItemType,
  generateStashId,
  isValidStashItem,
  sortStashByDate,
  filterStashByType,
  searchStash,
  STASH_STORAGE_KEY,
  STASH_MAX_ITEMS,
} from '../types/stash'

/**
 * Debounce delay for localStorage saves (in milliseconds).
 * Prevents excessive writes during rapid updates.
 */
const SAVE_DEBOUNCE_MS = 500

/**
 * Return type for the useStash hook.
 */
export interface UseStashReturn {
  /** All stash items, sorted by creation date (newest first) */
  items: StashItem[]

  /** Add a new item to the stash */
  addItem: (item: StashItemInput) => void

  /** Remove an item by ID */
  removeItem: (id: string) => void

  /** Update an existing item */
  updateItem: (id: string, updates: Partial<StashItemInput>) => void

  /** Clear all items from the stash */
  clearAll: () => void

  /** Get items filtered by type */
  getByType: (type: StashItemType) => StashItem[]

  /** Search items by content */
  search: (query: string) => StashItem[]

  /** Export stash as JSON string */
  exportToJSON: () => string

  /** Import stash from JSON string */
  importFromJSON: (json: string) => boolean

  /** Whether the sidebar is open */
  isOpen: boolean

  /** Toggle sidebar visibility */
  toggleOpen: () => void

  /** Set sidebar visibility explicitly */
  setIsOpen: (open: boolean) => void

  /** Current filter type (null = all) */
  filterType: StashItemType | null

  /** Set the filter type */
  setFilterType: (type: StashItemType | null) => void

  /** Current search query */
  searchQuery: string

  /** Set the search query */
  setSearchQuery: (query: string) => void

  /** Number of items in the stash */
  count: number

  /** Whether an item with the given content already exists */
  hasItem: (content: string, type: StashItemType) => boolean
}

/**
 * Loads stash items from localStorage.
 *
 * @returns Array of valid stash items, or empty array if none
 */
const loadFromStorage = (): StashItem[] => {
  try {
    const stored = localStorage.getItem(STASH_STORAGE_KEY)
    if (!stored) return []

    const parsed = JSON.parse(stored)
    if (!Array.isArray(parsed)) return []

    // Validate each item
    return parsed.filter(isValidStashItem)
  } catch (error) {
    console.error('[useStash] Failed to load from localStorage:', error)
    return []
  }
}

/**
 * Saves stash items to localStorage.
 *
 * @param items - Items to save
 */
const saveToStorage = (items: StashItem[]): void => {
  try {
    localStorage.setItem(STASH_STORAGE_KEY, JSON.stringify(items))
  } catch (error) {
    console.error('[useStash] Failed to save to localStorage:', error)
  }
}

/**
 * Custom hook for managing the Stash feature.
 *
 * Provides complete state management for the stash including:
 * - CRUD operations with automatic persistence
 * - Filtering and search
 * - Sidebar visibility toggle
 * - JSON export/import
 *
 * @returns Stash state and operations
 */
export function useStash(): UseStashReturn {
  // Core state - items array
  const [items, setItems] = useState<StashItem[]>(() => loadFromStorage())

  // UI state
  const [isOpen, setIsOpen] = useState(true)
  const [filterType, setFilterType] = useState<StashItemType | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Debounce timer ref
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Save to localStorage with debouncing
  useEffect(() => {
    // Clear any pending save
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
    }

    // Schedule new save
    saveTimerRef.current = setTimeout(() => {
      saveToStorage(items)
    }, SAVE_DEBOUNCE_MS)

    // Cleanup on unmount
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
      }
    }
  }, [items])

  /**
   * Add a new item to the stash.
   * Generates ID and timestamp automatically.
   * Enforces max items limit.
   */
  const addItem = useCallback((input: StashItemInput): void => {
    setItems(prev => {
      // Check for duplicates (same content and type)
      const exists = prev.some(
        item => item.content === input.content && item.type === input.type
      )
      if (exists) {
        console.log('[useStash] Item already exists, skipping add')
        return prev
      }

      // Create the new item
      const newItem: StashItem = {
        ...input,
        id: generateStashId(),
        createdAt: Date.now(),
      }

      // Add to beginning (newest first)
      let updated = [newItem, ...prev]

      // Enforce max items limit
      if (updated.length > STASH_MAX_ITEMS) {
        updated = updated.slice(0, STASH_MAX_ITEMS)
        console.log(`[useStash] Trimmed stash to ${STASH_MAX_ITEMS} items`)
      }

      console.log(`[useStash] Added item: ${input.type} - "${input.content.slice(0, 50)}..."`)
      return updated
    })
  }, [])

  /**
   * Remove an item by ID.
   */
  const removeItem = useCallback((id: string): void => {
    setItems(prev => {
      const item = prev.find(i => i.id === id)
      if (item) {
        console.log(`[useStash] Removed item: ${item.type} - "${item.content.slice(0, 50)}..."`)
      }
      return prev.filter(item => item.id !== id)
    })
  }, [])

  /**
   * Update an existing item.
   */
  const updateItem = useCallback((id: string, updates: Partial<StashItemInput>): void => {
    setItems(prev =>
      prev.map(item =>
        item.id === id
          ? { ...item, ...updates, metadata: { ...item.metadata, ...updates.metadata } }
          : item
      )
    )
  }, [])

  /**
   * Clear all items from the stash.
   */
  const clearAll = useCallback((): void => {
    console.log('[useStash] Clearing all items')
    setItems([])
    setFilterType(null)
    setSearchQuery('')
  }, [])

  /**
   * Get items filtered by type.
   */
  const getByType = useCallback(
    (type: StashItemType): StashItem[] => filterStashByType(items, type),
    [items]
  )

  /**
   * Search items by content.
   */
  const search = useCallback(
    (query: string): StashItem[] => searchStash(items, query),
    [items]
  )

  /**
   * Export stash as JSON string.
   */
  const exportToJSON = useCallback((): string => {
    return JSON.stringify(items, null, 2)
  }, [items])

  /**
   * Import stash from JSON string.
   * Merges with existing items, avoiding duplicates.
   *
   * @returns True if import was successful
   */
  const importFromJSON = useCallback((json: string): boolean => {
    try {
      const parsed = JSON.parse(json)
      if (!Array.isArray(parsed)) {
        console.error('[useStash] Import failed: not an array')
        return false
      }

      const validItems = parsed.filter(isValidStashItem)
      if (validItems.length === 0) {
        console.error('[useStash] Import failed: no valid items')
        return false
      }

      setItems(prev => {
        // Merge, avoiding duplicates by ID
        const existingIds = new Set(prev.map(i => i.id))
        const newItems = validItems.filter(i => !existingIds.has(i.id))
        const merged = sortStashByDate([...prev, ...newItems])

        console.log(`[useStash] Imported ${newItems.length} new items`)
        return merged.slice(0, STASH_MAX_ITEMS)
      })

      return true
    } catch (error) {
      console.error('[useStash] Import failed:', error)
      return false
    }
  }, [])

  /**
   * Toggle sidebar visibility.
   */
  const toggleOpen = useCallback((): void => {
    setIsOpen(prev => !prev)
  }, [])

  /**
   * Check if an item with the given content and type already exists.
   */
  const hasItem = useCallback(
    (content: string, type: StashItemType): boolean => {
      return items.some(item => item.content === content && item.type === type)
    },
    [items]
  )

  // Compute filtered/searched items
  const displayedItems = (() => {
    let result = items

    if (filterType) {
      result = filterStashByType(result, filterType)
    }

    if (searchQuery.trim()) {
      result = searchStash(result, searchQuery)
    }

    return result
  })()

  return {
    items: displayedItems,
    addItem,
    removeItem,
    updateItem,
    clearAll,
    getByType,
    search,
    exportToJSON,
    importFromJSON,
    isOpen,
    toggleOpen,
    setIsOpen,
    filterType,
    setFilterType,
    searchQuery,
    setSearchQuery,
    count: items.length, // Total count, not filtered
    hasItem,
  }
}
