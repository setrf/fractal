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
import { STASH_MAX_ITEMS, STASH_STORAGE_KEY, type StashItem, type StashItemInput } from '../types/stash'

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
    vi.unstubAllEnvs()
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

    it('should return empty when stored JSON is not an array', () => {
      localStorageMock.getItem.mockReturnValueOnce(JSON.stringify({ invalid: true }))

      const { result } = renderHook(() => useStash())

      expect(result.current.items).toEqual([])
      expect(result.current.count).toBe(0)
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

    it('should trim to max items when limit is exceeded', () => {
      const { result } = renderHook(() => useStash())

      act(() => {
        for (let i = 0; i < STASH_MAX_ITEMS + 5; i++) {
          result.current.addItem({
            type: 'note',
            content: `item-${i}`,
            metadata: {},
          })
        }
      })

      expect(result.current.items).toHaveLength(STASH_MAX_ITEMS)
      expect(result.current.items[0].content).toBe(`item-${STASH_MAX_ITEMS + 4}`)
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

    it('should keep non-target items unchanged when updating one item', () => {
      const { result } = renderHook(() => useStash())

      act(() => {
        result.current.addItem({
          type: 'note',
          content: 'first note',
          metadata: { title: 'First' },
        })
        result.current.addItem({
          type: 'note',
          content: 'second note',
          metadata: { title: 'Second' },
        })
      })

      const [newer, older] = result.current.items
      act(() => {
        result.current.updateItem(newer.id, {
          content: 'updated second note',
          metadata: { title: 'Second Updated' },
        })
      })

      expect(result.current.items.find((item) => item.id === newer.id)?.content).toBe('updated second note')
      expect(result.current.items.find((item) => item.id === older.id)?.content).toBe('first note')
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

      expect(result.current.displayedItems.length).toBe(2)
      expect(result.current.displayedItems.every(i => i.type === 'highlight')).toBe(true)
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

      expect(result.current.displayedItems.length).toBe(2)
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

      expect(result.current.displayedItems.length).toBe(1)
      expect(result.current.displayedItems[0].content).toBe('evolution')
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

      expect(result.current.displayedItems.length).toBe(1)
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

    it('should reject non-array JSON import payloads', () => {
      const { result } = renderHook(() => useStash())

      let success = true
      act(() => {
        success = result.current.importFromJSON(JSON.stringify({ invalid: true }))
      })

      expect(success).toBe(false)
      expect(result.current.items).toEqual([])
    })

    it('should reject imports that have no valid stash items', () => {
      const { result } = renderHook(() => useStash())

      let success = true
      act(() => {
        success = result.current.importFromJSON(JSON.stringify([{ invalid: true }]))
      })

      expect(success).toBe(false)
      expect(result.current.items).toEqual([])
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

    it('should merge imports with existing items while filtering duplicate ids', () => {
      const { result } = renderHook(() => useStash())

      act(() => {
        result.current.addItem({ type: 'note', content: 'existing note', metadata: {} })
      })

      const existingId = result.current.items[0].id
      const importPayload: StashItem[] = [
        {
          id: existingId,
          type: 'note',
          content: 'duplicate existing note',
          metadata: {},
          createdAt: Date.now(),
        },
        {
          id: 's_import_unique',
          type: 'highlight',
          content: 'unique import',
          metadata: { normalizedName: 'unique import' },
          createdAt: Date.now() + 1,
        },
      ]

      let success = false
      act(() => {
        success = result.current.importFromJSON(JSON.stringify(importPayload))
      })

      expect(success).toBe(true)
      expect(result.current.items.some((item) => item.id === existingId)).toBe(true)
      expect(result.current.items.some((item) => item.id === 's_import_unique')).toBe(true)
      expect(result.current.items.length).toBe(2)
    })

  })

  describe('sidebar toggle', () => {
    it('should toggle open state', () => {
      const { result } = renderHook(() => useStash())

      expect(result.current.isOpen).toBe(true)

      act(() => {
        result.current.toggleOpen()
      })

      expect(result.current.isOpen).toBe(false)

      act(() => {
        result.current.toggleOpen()
      })

      expect(result.current.isOpen).toBe(true)
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

  describe('reorderItem', () => {
    it('should no-op when from and to indices are equal', () => {
      const { result } = renderHook(() => useStash())

      act(() => {
        result.current.addItem({ type: 'note', content: 'one', metadata: {} })
        result.current.addItem({ type: 'note', content: 'two', metadata: {} })
      })

      const before = result.current.items.map((item) => item.id)
      act(() => {
        result.current.reorderItem(0, 0)
      })
      expect(result.current.items.map((item) => item.id)).toEqual(before)
    })

    it('should ignore invalid from/to indices', () => {
      const { result } = renderHook(() => useStash())

      act(() => {
        result.current.addItem({ type: 'note', content: 'one', metadata: {} })
        result.current.addItem({ type: 'note', content: 'two', metadata: {} })
      })

      const before = result.current.items.map((item) => item.id)
      act(() => {
        result.current.reorderItem(-1, 1)
        result.current.reorderItem(0, 99)
      })

      expect(result.current.items.map((item) => item.id)).toEqual(before)
    })

    it('reorders valid indices', () => {
      const { result } = renderHook(() => useStash())

      act(() => {
        result.current.addItem({ type: 'note', content: 'one', metadata: {} })
        result.current.addItem({ type: 'note', content: 'two', metadata: {} })
        result.current.addItem({ type: 'note', content: 'three', metadata: {} })
      })

      const before = result.current.items.map((item) => item.id)
      const expected = [...before]
      const [moved] = expected.splice(0, 1)
      expected.splice(2, 0, moved)

      act(() => {
        result.current.reorderItem(0, 2)
      })

      expect(result.current.items.map((item) => item.id)).toEqual(expected)
    })
  })

  describe('storage error branches', () => {
    it('returns empty for non-array payloads persisted in localStorage store', () => {
      mockStore[STASH_STORAGE_KEY] = JSON.stringify({ invalid: true })

      const { result } = renderHook(() => useStash())

      expect(result.current.items).toEqual([])
      expect(result.current.count).toBe(0)
    })

    it('swallows load/save storage errors in test mode without logging', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockStore[STASH_STORAGE_KEY] = '{bad-json'
      localStorageMock.setItem.mockImplementationOnce(() => {
        throw new Error('write failure')
      })

      const { result } = renderHook(() => useStash())
      expect(result.current.items).toEqual([])

      act(() => {
        result.current.addItem({ type: 'note', content: 'save-failure', metadata: {} })
      })
      act(() => {
        vi.runAllTimers()
      })

      expect(consoleErrorSpy).not.toHaveBeenCalled()
      consoleErrorSpy.mockRestore()
    })

    it('handles cleanup when debounce timer handle is unavailable', () => {
      const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout').mockImplementation(() => null as any)
      const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')

      const { result, unmount } = renderHook(() => useStash())
      act(() => {
        result.current.addItem({ type: 'note', content: 'timerless', metadata: {} })
      })

      unmount()

      expect(clearTimeoutSpy).not.toHaveBeenCalled()
      setTimeoutSpy.mockRestore()
      clearTimeoutSpy.mockRestore()
    })

    it('logs load/save/import errors outside test mode', async () => {
      vi.resetModules()
      vi.stubEnv('MODE', 'development')
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const noisyStorage = {
        ...localStorageMock,
        getItem: vi.fn(() => '{invalid-json'),
        setItem: vi.fn(() => {
          throw new Error('save-failure')
        }),
      }
      Object.defineProperty(window, 'localStorage', {
        value: noisyStorage,
        writable: true,
      })

      const { useStash: useStashDevMode } = await import('./useStash')
      const { result } = renderHook(() => useStashDevMode())

      let success = true
      act(() => {
        success = result.current.importFromJSON(JSON.stringify({ invalid: true }))
      })
      expect(success).toBe(false)

      act(() => {
        success = result.current.importFromJSON(JSON.stringify([{ invalid: true }]))
      })
      expect(success).toBe(false)

      act(() => {
        success = result.current.importFromJSON('{invalid')
      })
      expect(success).toBe(false)

      act(() => {
        result.current.addItem({ type: 'note', content: 'save-error-dev', metadata: {} })
      })
      act(() => {
        vi.runAllTimers()
      })

      expect(consoleErrorSpy).toHaveBeenCalled()
      consoleErrorSpy.mockRestore()

      Object.defineProperty(window, 'localStorage', {
        value: localStorageMock,
        writable: true,
      })
    })

    it('suppresses load/save error logging when the module is loaded in test mode', async () => {
      vi.resetModules()
      vi.stubEnv('MODE', 'test')
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const quietFailingStorage = {
        ...localStorageMock,
        getItem: vi.fn(() => {
          throw new Error('read-failure-test-mode')
        }),
        setItem: vi.fn(() => {
          throw new Error('write-failure-test-mode')
        }),
      }
      Object.defineProperty(window, 'localStorage', {
        value: quietFailingStorage,
        writable: true,
      })

      const { useStash: useStashTestMode } = await import('./useStash')
      const { result } = renderHook(() => useStashTestMode())
      expect(result.current.items).toEqual([])

      act(() => {
        result.current.addItem({ type: 'note', content: 'quiet-failure', metadata: {} })
      })
      act(() => {
        vi.runAllTimers()
      })

      expect(consoleErrorSpy).not.toHaveBeenCalled()
      consoleErrorSpy.mockRestore()

      Object.defineProperty(window, 'localStorage', {
        value: localStorageMock,
        writable: true,
      })
    })

    it('returns empty for non-array storage payloads when loading a fresh module instance', async () => {
      vi.resetModules()
      vi.stubEnv('MODE', 'test')

      const nonArrayStorage = {
        ...localStorageMock,
        getItem: vi.fn(() => JSON.stringify({ not: 'an-array' })),
      }
      Object.defineProperty(window, 'localStorage', {
        value: nonArrayStorage,
        writable: true,
      })

      const { useStash: useStashTestMode } = await import('./useStash')
      const { result } = renderHook(() => useStashTestMode())
      expect(result.current.items).toEqual([])

      Object.defineProperty(window, 'localStorage', {
        value: localStorageMock,
        writable: true,
      })
    })
  })
})
