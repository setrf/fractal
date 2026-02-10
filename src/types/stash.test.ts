/**
 * @fileoverview Tests for stash type utilities.
 *
 * Tests cover:
 * - ID generation
 * - Item validation
 * - Sorting functions
 * - Filtering functions
 * - Search functions
 */

import { describe, it, expect } from 'vitest'
import {
  generateStashId,
  isValidStashItem,
  sortStashByDate,
  filterStashByType,
  searchStash,
  type StashItem,
} from './stash'

describe('stash utilities', () => {
  describe('generateStashId', () => {
    it('should generate an ID starting with s_', () => {
      const id = generateStashId()
      expect(id).toMatch(/^s_/)
    })

    it('should generate unique IDs', () => {
      const id1 = generateStashId()
      const id2 = generateStashId()
      expect(id1).not.toBe(id2)
    })

    it('should include timestamp in the ID', () => {
      const before = Date.now()
      const id = generateStashId()
      const after = Date.now()

      // Extract timestamp from ID (format: s_TIMESTAMP_RANDOM)
      const timestamp = parseInt(id.split('_')[1], 10)
      expect(timestamp).toBeGreaterThanOrEqual(before)
      expect(timestamp).toBeLessThanOrEqual(after)
    })
  })

  describe('isValidStashItem', () => {
    const validItem: StashItem = {
      id: 's_123_abc',
      type: 'highlight',
      content: 'test content',
      metadata: {},
      createdAt: Date.now(),
    }

    it('should return true for valid item', () => {
      expect(isValidStashItem(validItem)).toBe(true)
    })

    it('should return false for null', () => {
      expect(isValidStashItem(null)).toBe(false)
    })

    it('should return false for undefined', () => {
      expect(isValidStashItem(undefined)).toBe(false)
    })

    it('should return false for primitive values', () => {
      expect(isValidStashItem('string')).toBe(false)
      expect(isValidStashItem(123)).toBe(false)
      expect(isValidStashItem(true)).toBe(false)
    })

    it('should return false for missing id', () => {
      const item = { ...validItem }
      delete (item as Partial<StashItem>).id
      expect(isValidStashItem(item)).toBe(false)
    })

    it('should return false for missing type', () => {
      const item = { ...validItem }
      delete (item as Partial<StashItem>).type
      expect(isValidStashItem(item)).toBe(false)
    })

    it('should return false for missing content', () => {
      const item = { ...validItem }
      delete (item as Partial<StashItem>).content
      expect(isValidStashItem(item)).toBe(false)
    })

    it('should return false for missing metadata', () => {
      const item = { ...validItem }
      delete (item as Partial<StashItem>).metadata
      expect(isValidStashItem(item)).toBe(false)
    })

    it('should return false for missing createdAt', () => {
      const item = { ...validItem }
      delete (item as Partial<StashItem>).createdAt
      expect(isValidStashItem(item)).toBe(false)
    })

    it('should return false for wrong type for id', () => {
      const item = { ...validItem, id: 123 }
      expect(isValidStashItem(item)).toBe(false)
    })

    it('should return false for wrong type for createdAt', () => {
      const item = { ...validItem, createdAt: '2024-01-01' }
      expect(isValidStashItem(item)).toBe(false)
    })

    it('should validate optional string-array fields', () => {
      const withArrays = {
        ...validItem,
        tags: ['a', 'b'],
        assignedProbeIds: ['p_1', 'p_2'],
      }
      expect(isValidStashItem(withArrays)).toBe(true)

      const invalidTags = { ...validItem, tags: ['ok', 123] }
      expect(isValidStashItem(invalidTags)).toBe(false)
    })

    it('should reject invalid assignedProbeIds array entries', () => {
      const invalidProbeIds = { ...validItem, assignedProbeIds: ['p_1', 42] }
      expect(isValidStashItem(invalidProbeIds)).toBe(false)
    })

    it('should validate all optional metadata field types', () => {
      const validMetadataItem: StashItem = {
        ...validItem,
        type: 'chat-message',
        metadata: {
          relatedConcepts: ['memory', 'sleep'],
          conceptCategory: 'science',
          role: 'assistant',
          messageIndex: 3,
          treeDepth: 2,
          questionId: 'q_1',
          parentQuestion: 'Why do we dream?',
          sourceQuestion: 'What is sleep?',
          normalizedName: 'dream',
          summary: 'Summary text',
          context: 'Context text',
          questionContext: 'Conversation root',
          linkedItemId: 's_123',
          title: 'My note title',
        },
      }

      expect(isValidStashItem(validMetadataItem)).toBe(true)

      const cases: Array<{ name: string; metadata: Record<string, unknown> }> = [
        { name: 'relatedConcepts must be string[]', metadata: { relatedConcepts: ['ok', 1] } },
        { name: 'conceptCategory must be valid enum', metadata: { conceptCategory: 'invalid' } },
        { name: 'role must be user/assistant', metadata: { role: 'system' } },
        { name: 'messageIndex must be number', metadata: { messageIndex: '3' } },
        { name: 'treeDepth must be number', metadata: { treeDepth: '2' } },
        { name: 'questionId must be string', metadata: { questionId: 99 } },
        { name: 'parentQuestion must be string', metadata: { parentQuestion: 99 } },
        { name: 'sourceQuestion must be string', metadata: { sourceQuestion: 99 } },
        { name: 'normalizedName must be string', metadata: { normalizedName: 99 } },
        { name: 'summary must be string', metadata: { summary: 99 } },
        { name: 'context must be string', metadata: { context: 99 } },
        { name: 'questionContext must be string', metadata: { questionContext: 99 } },
        { name: 'linkedItemId must be string', metadata: { linkedItemId: 99 } },
        { name: 'title must be string', metadata: { title: 99 } },
      ]

      for (const testCase of cases) {
        const item = {
          ...validItem,
          metadata: testCase.metadata,
        }
        expect(isValidStashItem(item), testCase.name).toBe(false)
      }
    })
  })

  describe('sortStashByDate', () => {
    it('should sort items by createdAt descending (newest first)', () => {
      const items: StashItem[] = [
        { id: 's_1', type: 'highlight', content: 'a', metadata: {}, createdAt: 100 },
        { id: 's_2', type: 'highlight', content: 'b', metadata: {}, createdAt: 300 },
        { id: 's_3', type: 'highlight', content: 'c', metadata: {}, createdAt: 200 },
      ]

      const sorted = sortStashByDate(items)

      expect(sorted[0].createdAt).toBe(300)
      expect(sorted[1].createdAt).toBe(200)
      expect(sorted[2].createdAt).toBe(100)
    })

    it('should not mutate the original array', () => {
      const items: StashItem[] = [
        { id: 's_1', type: 'highlight', content: 'a', metadata: {}, createdAt: 100 },
        { id: 's_2', type: 'highlight', content: 'b', metadata: {}, createdAt: 300 },
      ]

      const originalFirst = items[0]
      sortStashByDate(items)

      expect(items[0]).toBe(originalFirst)
    })

    it('should return empty array for empty input', () => {
      expect(sortStashByDate([])).toEqual([])
    })
  })

  describe('filterStashByType', () => {
    const items: StashItem[] = [
      { id: 's_1', type: 'highlight', content: 'a', metadata: {}, createdAt: 100 },
      { id: 's_2', type: 'question', content: 'b', metadata: {}, createdAt: 200 },
      { id: 's_3', type: 'highlight', content: 'c', metadata: {}, createdAt: 300 },
      { id: 's_4', type: 'note', content: 'd', metadata: {}, createdAt: 400 },
    ]

    it('should filter items by type', () => {
      const filtered = filterStashByType(items, 'highlight')

      expect(filtered.length).toBe(2)
      expect(filtered.every(i => i.type === 'highlight')).toBe(true)
    })

    it('should return empty array when no items match', () => {
      const filtered = filterStashByType(items, 'chat-message')

      expect(filtered).toEqual([])
    })

    it('should return all items of the specified type', () => {
      const filtered = filterStashByType(items, 'question')

      expect(filtered.length).toBe(1)
      expect(filtered[0].content).toBe('b')
    })
  })

  describe('searchStash', () => {
    const items: StashItem[] = [
      {
        id: 's_1',
        type: 'highlight',
        content: 'evolutionary biology',
        metadata: { normalizedName: 'evolution' },
        createdAt: 100,
      },
      {
        id: 's_2',
        type: 'question',
        content: 'Why do we dream?',
        metadata: {},
        createdAt: 200,
      },
      {
        id: 's_3',
        type: 'note',
        content: 'Research notes',
        metadata: { title: 'Biology Research' },
        createdAt: 300,
        tags: ['science', 'biology'],
      },
    ]

    it('should search by content', () => {
      const results = searchStash(items, 'dream')

      expect(results.length).toBe(1)
      expect(results[0].content).toBe('Why do we dream?')
    })

    it('should search by normalizedName', () => {
      const results = searchStash(items, 'evolution')

      expect(results.length).toBe(1)
      expect(results[0].metadata.normalizedName).toBe('evolution')
    })

    it('should search by title', () => {
      const results = searchStash(items, 'Biology Research')

      expect(results.length).toBe(1)
      expect(results[0].metadata.title).toBe('Biology Research')
    })

    it('should search by tags', () => {
      const results = searchStash(items, 'science')

      expect(results.length).toBe(1)
      expect(results[0].tags).toContain('science')
    })

    it('should be case-insensitive', () => {
      const results = searchStash(items, 'EVOLUTIONARY')

      expect(results.length).toBe(1)
    })

    it('should return empty array when no matches', () => {
      const results = searchStash(items, 'xyz123')

      expect(results).toEqual([])
    })

    it('should match partial strings', () => {
      const results = searchStash(items, 'bio')

      expect(results.length).toBe(2) // matches 'evolutionary biology' and 'Biology Research'
    })
  })
})
