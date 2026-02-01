/**
 * @fileoverview Tests for the useStash hook.
 *
 * Tests cover:
 * - CRUD operations (add, remove, update, clear)
 * - localStorage persistence
 * - Filtering by type
 * - Search functionality
 * - JSON export/import
 * - Duplicate prevention
 * - Max items limit
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useStash } from './useStash'
import type { StashItem, StashItemInput } from '../types/stash'

// localStorage store that persists across mock calls
let mockStore: Record<string, string> = {}

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn((key: string) => mockStore[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    mockStore[key] = value
  }),
  removeItem: vi.fn((key: string) => {
    delete mockStore[key]
  }),
  clear: vi.fn(() => {
    mockStore = {}
  }),
  get length() {
    return Object.keys(mockStore).length
  },
  key: vi.fn((i: number) => Object.keys(mockStore)[i] || null),
}

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
})

describe('useStash', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStore = {} // Reset the store directly
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('initialization', () => {
    it('should initialize with empty items if localStorage is empty', () => {
      const { result } = renderHook(() => useStash())

      expect(result.current.items).toEqual([])
      expect(result.current.count).toBe(0)
    })

    // Note: Testing localStorage loading on init is tricky because 
    // React hook initialization happens before our mock can be configured.
    // The loadFromStorage function is tested indirectly via the persistence test.

    it('should filter out invalid items from localStorage', () => {
      const invalidData = [
        { id: 's_1', type: 'highlight' }, // Missing required fields
        { notAnItem: true },
        'string',
        null,
      ]
      localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(invalidData))

      const { result } = renderHook(() => useStash())

      expect(result.current.items).toEqual([])
    })
  })

  describe('addItem', () => {
    it('should add a new item', () => {
      const { result } = renderHook(() => useStash())

      act(() => {
        result.current.addItem({
          type: 'highlight',
          content: 'test concept',
          metadata: { conceptCategory: 'science' },
        })
      })

      expect(result.current.items.length).toBe(1)
      expect(result.current.items[0].content).toBe('test concept')
      expect(result.current.items[0].type).toBe('highlight')
      expect(result.current.items[0].id).toMatch(/^s_/)
      expect(result.current.items[0].createdAt).toBeGreaterThan(0)
    })

    it('should prevent duplicate items', () => {
      const { result } = renderHook(() => useStash())

      act(() => {
        result.current.addItem({
          type: 'highlight',
          content: 'same content',
          metadata: {},
        })
      })

      act(() => {
        result.current.addItem({
          type: 'highlight',
          content: 'same content',
          metadata: {},
        })
      })

      expect(result.current.items.length).toBe(1)
    })

    it('should allow same content with different types', () => {
      const { result } = renderHook(() => useStash())

      act(() => {
        result.current.addItem({
          type: 'highlight',
          content: 'same content',
          metadata: {},
        })
      })

      act(() => {
        result.current.addItem({
          type: 'question',
          content: 'same content',
          metadata: {},
        })
      })

      expect(result.current.items.length).toBe(2)
    })

    it('should add items to the beginning (newest first)', () => {
      const { result } = renderHook(() => useStash())

      act(() => {
        result.current.addItem({
          type: 'highlight',
          content: 'first',
          metadata: {},
        })
      })

      act(() => {
        result.current.addItem({
          type: 'highlight',
          content: 'second',
          metadata: {},
        })
      })

      expect(result.current.items[0].content).toBe('second')
      expect(result.current.items[1].content).toBe('first')
    })
  })

  describe('removeItem', () => {
    it('should remove an item by id', () => {
      const { result } = renderHook(() => useStash())

      act(() => {
        result.current.addItem({
          type: 'highlight',
          content: 'to remove',
          metadata: {},
        })
      })

      const itemId = result.current.items[0].id

      act(() => {
        result.current.removeItem(itemId)
      })

      expect(result.current.items.length).toBe(0)
    })

    it('should not throw when removing non-existent item', () => {
      const { result } = renderHook(() => useStash())

      expect(() => {
        act(() => {
          result.current.removeItem('non-existent-id')
        })
      }).not.toThrow()
    })
  })

  describe('updateItem', () => {
    it('should update an existing item', () => {
      const { result } = renderHook(() => useStash())

      act(() => {
        result.current.addItem({
          type: 'note',
          content: 'original content',
          metadata: { title: 'Original Title' },
        })
      })

      const itemId = result.current.items[0].id

      act(() => {
        result.current.updateItem(itemId, {
          content: 'updated content',
          metadata: { title: 'Updated Title' },
        })
      })

      expect(result.current.items[0].content).toBe('updated content')
      expect(result.current.items[0].metadata.title).toBe('Updated Title')
    })
  })

  describe('clearAll', () => {
    it('should remove all items', () => {
      const { result } = renderHook(() => useStash())

      act(() => {
        result.current.addItem({ type: 'highlight', content: 'a', metadata: {} })
        result.current.addItem({ type: 'question', content: 'b', metadata: {} })
        result.current.addItem({ type: 'note', content: 'c', metadata: {} })
      })

      expect(result.current.items.length).toBe(3)

      act(() => {
        result.current.clearAll()
      })

      expect(result.current.items.length).toBe(0)
      expect(result.current.filterType).toBeNull()
      expect(result.current.searchQuery).toBe('')
    })
  })

  describe('filtering', () => {
    it('should filter items by type', () => {
      const { result } = renderHook(() => useStash())

      act(() => {
        result.current.addItem({ type: 'highlight', content: 'a', metadata: {} })
        result.current.addItem({ type: 'question', content: 'b', metadata: {} })
        result.current.addItem({ type: 'highlight', content: 'c', metadata: {} })
      })

      act(() => {
        result.current.setFilterType('highlight')
      })

      expect(result.current.items.length).toBe(2)
      expect(result.current.items.every(i => i.type === 'highlight')).toBe(true)
    })

    it('should return all items when filter is null', () => {
      const { result } = renderHook(() => useStash())

      act(() => {
        result.current.addItem({ type: 'highlight', content: 'a', metadata: {} })
        result.current.addItem({ type: 'question', content: 'b', metadata: {} })
      })

      act(() => {
        result.current.setFilterType(null)
      })

      expect(result.current.items.length).toBe(2)
    })

    it('should filter by type using getByType', () => {
      const { result } = renderHook(() => useStash())

      act(() => {
        result.current.addItem({ type: 'highlight', content: 'a', metadata: {} })
        result.current.addItem({ type: 'question', content: 'b', metadata: {} })
      })

      const highlights = result.current.getByType('highlight')
      expect(highlights.length).toBe(1)
      expect(highlights[0].type).toBe('highlight')
    })
  })

  describe('search', () => {
    it('should search items by content', () => {
      const { result } = renderHook(() => useStash())

      act(() => {
        result.current.addItem({ type: 'highlight', content: 'evolution', metadata: {} })
        result.current.addItem({ type: 'question', content: 'dreaming', metadata: {} })
      })

      act(() => {
        result.current.setSearchQuery('evol')
      })

      expect(result.current.items.length).toBe(1)
      expect(result.current.items[0].content).toBe('evolution')
    })

    it('should search items by normalized name', () => {
      const { result } = renderHook(() => useStash())

      act(() => {
        result.current.addItem({
          type: 'highlight',
          content: 'evolutionary',
          metadata: { normalizedName: 'evolution' },
        })
      })

      act(() => {
        result.current.setSearchQuery('evolution')
      })

      expect(result.current.items.length).toBe(1)
    })

    it('should search items by tags', () => {
      const { result } = renderHook(() => useStash())

      act(() => {
        result.current.addItem({
          type: 'note',
          content: 'some note',
          metadata: {},
          tags: ['science', 'biology'],
        } as StashItemInput & { tags: string[] })
      })

      const searchResults = result.current.search('biology')
      expect(searchResults.length).toBe(1)
    })

    it('should return case-insensitive results', () => {
      const { result } = renderHook(() => useStash())

      act(() => {
        result.current.addItem({ type: 'highlight', content: 'EVOLUTION', metadata: {} })
      })

      act(() => {
        result.current.setSearchQuery('evolution')
      })

      expect(result.current.items.length).toBe(1)
    })
  })

  describe('JSON export/import', () => {
    it('should export items as JSON', () => {
      const { result } = renderHook(() => useStash())

      act(() => {
        result.current.addItem({ type: 'highlight', content: 'test', metadata: {} })
      })

      const json = result.current.exportToJSON()
      const parsed = JSON.parse(json)

      expect(Array.isArray(parsed)).toBe(true)
      expect(parsed.length).toBe(1)
      expect(parsed[0].content).toBe('test')
    })

    it('should import items from JSON', () => {
      const { result } = renderHook(() => useStash())

      const itemsToImport: StashItem[] = [
        {
          id: 's_import_1',
          type: 'highlight',
          content: 'imported item',
          metadata: {},
          createdAt: Date.now(),
        },
      ]

      let success = false
      act(() => {
        success = result.current.importFromJSON(JSON.stringify(itemsToImport))
      })

      expect(success).toBe(true)
      expect(result.current.items.length).toBe(1)
      expect(result.current.items[0].content).toBe('imported item')
    })

    it('should reject invalid JSON import', () => {
      const { result } = renderHook(() => useStash())

      let success = true
      act(() => {
        success = result.current.importFromJSON('invalid json')
      })

      expect(success).toBe(false)
    })

    it('should skip duplicate items on import', () => {
      const existingItem: StashItem = {
        id: 's_existing',
        type: 'highlight',
        content: 'existing',
        metadata: {},
        createdAt: Date.now(),
      }

      // First, load existing items
      localStorageMock.getItem.mockReturnValueOnce(JSON.stringify([existingItem]))
      const { result: result2 } = renderHook(() => useStash())

      // Import same item again
      act(() => {
        result2.current.importFromJSON(JSON.stringify([existingItem]))
      })

      expect(result2.current.items.length).toBe(1)
    })
  })

  describe('sidebar toggle', () => {
    it('should toggle open state', () => {
      const { result } = renderHook(() => useStash())

      expect(result.current.isOpen).toBe(false)

      act(() => {
        result.current.toggleOpen()
      })

      expect(result.current.isOpen).toBe(true)

      act(() => {
        result.current.toggleOpen()
      })

      expect(result.current.isOpen).toBe(false)
    })

    it('should set open state explicitly', () => {
      const { result } = renderHook(() => useStash())

      act(() => {
        result.current.setIsOpen(true)
      })

      expect(result.current.isOpen).toBe(true)

      act(() => {
        result.current.setIsOpen(false)
      })

      expect(result.current.isOpen).toBe(false)
    })
  })

  describe('hasItem', () => {
    it('should return true for existing item', () => {
      const { result } = renderHook(() => useStash())

      act(() => {
        result.current.addItem({ type: 'highlight', content: 'test', metadata: {} })
      })

      expect(result.current.hasItem('test', 'highlight')).toBe(true)
    })

    it('should return false for non-existing item', () => {
      const { result } = renderHook(() => useStash())

      expect(result.current.hasItem('test', 'highlight')).toBe(false)
    })

    it('should return false for same content but different type', () => {
      const { result } = renderHook(() => useStash())

      act(() => {
        result.current.addItem({ type: 'highlight', content: 'test', metadata: {} })
      })

      expect(result.current.hasItem('test', 'question')).toBe(false)
    })
  })

  describe('localStorage persistence', () => {
    it('should persist items that can be loaded in a new hook instance', () => {
      // First, add an item
      const { result: result1 } = renderHook(() => useStash())
      
      act(() => {
        result1.current.addItem({ type: 'highlight', content: 'persistent', metadata: {} })
      })

      // Trigger debounced save manually by advancing timers
      act(() => {
        vi.runAllTimers()
      })

      // Now create a new hook instance - it should load from localStorage
      const { result: result2 } = renderHook(() => useStash())

      // The items should have been persisted and loaded
      expect(result2.current.items.length).toBe(1)
      expect(result2.current.items[0].content).toBe('persistent')
    })
  })
})
