/**
 * @fileoverview Tests for probe type utilities.
 *
 * Tests cover:
 * - ID generation
 * - Probe validation
 * - Message validation
 * - Color management
 * - Sorting functions
 */

import { describe, it, expect } from 'vitest'
import {
  generateProbeId,
  generateProbeMessageId,
  isValidProbe,
  isValidProbeMessage,
  sortProbesByDate,
  getNextAvailableColor,
  createDefaultProbeName,
  PROBE_COLORS,
  MAX_PROBES,
  type Probe,
  type ProbeMessage,
} from './probe'

describe('probe utilities', () => {
  describe('generateProbeId', () => {
    it('should generate an ID starting with p_', () => {
      const id = generateProbeId()
      expect(id).toMatch(/^p_/)
    })

    it('should generate unique IDs', () => {
      const id1 = generateProbeId()
      const id2 = generateProbeId()
      expect(id1).not.toBe(id2)
    })

    it('should include timestamp in the ID', () => {
      const before = Date.now()
      const id = generateProbeId()
      const after = Date.now()

      // Extract timestamp from ID (format: p_TIMESTAMP_RANDOM)
      const timestamp = parseInt(id.split('_')[1], 10)
      expect(timestamp).toBeGreaterThanOrEqual(before)
      expect(timestamp).toBeLessThanOrEqual(after)
    })
  })

  describe('generateProbeMessageId', () => {
    it('should generate an ID starting with pm_', () => {
      const id = generateProbeMessageId()
      expect(id).toMatch(/^pm_/)
    })

    it('should generate unique IDs', () => {
      const id1 = generateProbeMessageId()
      const id2 = generateProbeMessageId()
      expect(id1).not.toBe(id2)
    })
  })

  describe('isValidProbe', () => {
    const validProbe: Probe = {
      id: 'p_123_abc',
      name: 'Test Probe',
      color: 'blue',
      messages: [],
      selectedStashItemIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    it('should return true for valid probe', () => {
      expect(isValidProbe(validProbe)).toBe(true)
    })

    it('should return false for null', () => {
      expect(isValidProbe(null)).toBe(false)
    })

    it('should return false for undefined', () => {
      expect(isValidProbe(undefined)).toBe(false)
    })

    it('should return false for primitive values', () => {
      expect(isValidProbe('string')).toBe(false)
      expect(isValidProbe(123)).toBe(false)
      expect(isValidProbe(true)).toBe(false)
    })

    it('should return false for missing id', () => {
      const probe = { ...validProbe }
      delete (probe as Partial<Probe>).id
      expect(isValidProbe(probe)).toBe(false)
    })

    it('should return false for missing name', () => {
      const probe = { ...validProbe }
      delete (probe as Partial<Probe>).name
      expect(isValidProbe(probe)).toBe(false)
    })

    it('should return false for invalid color', () => {
      const probe = { ...validProbe, color: 'invalid' as any }
      expect(isValidProbe(probe)).toBe(false)
    })

    it('should return false for non-array messages', () => {
      const probe = { ...validProbe, messages: 'not an array' as any }
      expect(isValidProbe(probe)).toBe(false)
    })

    it('should return false for non-array selectedStashItemIds', () => {
      const probe = { ...validProbe, selectedStashItemIds: 'not an array' as any }
      expect(isValidProbe(probe)).toBe(false)
    })

    it('should accept all valid colors', () => {
      for (const color of PROBE_COLORS) {
        const probe = { ...validProbe, color }
        expect(isValidProbe(probe)).toBe(true)
      }
    })
  })

  describe('isValidProbeMessage', () => {
    const validMessage: ProbeMessage = {
      id: 'pm_123_abc',
      role: 'user',
      content: 'Hello',
      timestamp: Date.now(),
    }

    it('should return true for valid message', () => {
      expect(isValidProbeMessage(validMessage)).toBe(true)
    })

    it('should return false for null', () => {
      expect(isValidProbeMessage(null)).toBe(false)
    })

    it('should return false for missing id', () => {
      const msg = { ...validMessage }
      delete (msg as Partial<ProbeMessage>).id
      expect(isValidProbeMessage(msg)).toBe(false)
    })

    it('should return false for invalid role', () => {
      const msg = { ...validMessage, role: 'invalid' as any }
      expect(isValidProbeMessage(msg)).toBe(false)
    })

    it('should accept valid roles', () => {
      for (const role of ['user', 'assistant', 'system'] as const) {
        const msg = { ...validMessage, role }
        expect(isValidProbeMessage(msg)).toBe(true)
      }
    })

    it('should return false for non-string content', () => {
      const msg = { ...validMessage, content: 123 as any }
      expect(isValidProbeMessage(msg)).toBe(false)
    })

    it('should return false for non-number timestamp', () => {
      const msg = { ...validMessage, timestamp: '2024-01-01' as any }
      expect(isValidProbeMessage(msg)).toBe(false)
    })
  })

  describe('sortProbesByDate', () => {
    it('should sort probes by createdAt descending (newest first)', () => {
      const probes: Probe[] = [
        {
          id: 'p_1',
          name: 'A',
          color: 'blue',
          messages: [],
          selectedStashItemIds: [],
          createdAt: 100,
          updatedAt: 100,
        },
        {
          id: 'p_2',
          name: 'B',
          color: 'green',
          messages: [],
          selectedStashItemIds: [],
          createdAt: 300,
          updatedAt: 300,
        },
        {
          id: 'p_3',
          name: 'C',
          color: 'yellow',
          messages: [],
          selectedStashItemIds: [],
          createdAt: 200,
          updatedAt: 200,
        },
      ]

      const sorted = sortProbesByDate(probes)

      expect(sorted[0].createdAt).toBe(300)
      expect(sorted[1].createdAt).toBe(200)
      expect(sorted[2].createdAt).toBe(100)
    })

    it('should not mutate the original array', () => {
      const probes: Probe[] = [
        {
          id: 'p_1',
          name: 'A',
          color: 'blue',
          messages: [],
          selectedStashItemIds: [],
          createdAt: 100,
          updatedAt: 100,
        },
        {
          id: 'p_2',
          name: 'B',
          color: 'green',
          messages: [],
          selectedStashItemIds: [],
          createdAt: 300,
          updatedAt: 300,
        },
      ]

      const originalFirst = probes[0]
      sortProbesByDate(probes)

      expect(probes[0]).toBe(originalFirst)
    })

    it('should return empty array for empty input', () => {
      expect(sortProbesByDate([])).toEqual([])
    })
  })

  describe('getNextAvailableColor', () => {
    it('should return first color when no probes exist', () => {
      const color = getNextAvailableColor([])
      expect(color).toBe('blue')
    })

    it('should return next unused color', () => {
      const probes: Probe[] = [
        {
          id: 'p_1',
          name: 'A',
          color: 'blue',
          messages: [],
          selectedStashItemIds: [],
          createdAt: 100,
          updatedAt: 100,
        },
      ]

      const color = getNextAvailableColor(probes)
      expect(color).toBe('green')
    })

    it('should skip used colors', () => {
      const probes: Probe[] = [
        {
          id: 'p_1',
          name: 'A',
          color: 'blue',
          messages: [],
          selectedStashItemIds: [],
          createdAt: 100,
          updatedAt: 100,
        },
        {
          id: 'p_2',
          name: 'B',
          color: 'green',
          messages: [],
          selectedStashItemIds: [],
          createdAt: 200,
          updatedAt: 200,
        },
      ]

      const color = getNextAvailableColor(probes)
      expect(color).toBe('yellow')
    })

    it('should return null when all colors are used', () => {
      const probes: Probe[] = PROBE_COLORS.map((color, i) => ({
        id: `p_${i}`,
        name: `Probe ${i}`,
        color,
        messages: [],
        selectedStashItemIds: [],
        createdAt: i * 100,
        updatedAt: i * 100,
      }))

      const color = getNextAvailableColor(probes)
      expect(color).toBe(null)
    })
  })

  describe('createDefaultProbeName', () => {
    it('should create numbered name based on existing probes', () => {
      const probes: Probe[] = []
      const name = createDefaultProbeName('blue', probes)
      expect(name).toBe('Probe 1')
    })

    it('should increment number based on probe count', () => {
      const probes: Probe[] = [
        {
          id: 'p_1',
          name: 'Probe 1',
          color: 'blue',
          messages: [],
          selectedStashItemIds: [],
          createdAt: 100,
          updatedAt: 100,
        },
      ]

      const name = createDefaultProbeName('green', probes)
      expect(name).toBe('Probe 2')
    })
  })

  describe('constants', () => {
    it('should have 5 probe colors', () => {
      expect(PROBE_COLORS.length).toBe(5)
    })

    it('should have MAX_PROBES equal to number of colors', () => {
      expect(MAX_PROBES).toBe(PROBE_COLORS.length)
    })

    it('should contain expected colors', () => {
      expect(PROBE_COLORS).toContain('blue')
      expect(PROBE_COLORS).toContain('green')
      expect(PROBE_COLORS).toContain('yellow')
      expect(PROBE_COLORS).toContain('purple')
      expect(PROBE_COLORS).toContain('orange')
    })
  })
})
