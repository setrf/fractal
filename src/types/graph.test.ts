/**
 * Graph Type Tests
 * =================
 *
 * Tests for graph-related types and utility functions.
 *
 * Test Coverage:
 * - truncateLabel utility
 * - isValidViewMode validation
 * - Default constants
 */

import { describe, it, expect } from 'vitest'
import {
  generateGraphId,
  truncateLabel,
  isValidViewMode,
  DEFAULT_GRAPH_FILTERS,
  DEFAULT_VIEW_MODE,
  NODE_SIZE_MULTIPLIERS,
  EDGE_WIDTHS,
  EDGE_STRENGTHS,
  nodeTypeLabels,
  edgeTypeLabels,
} from './graph'

describe('Graph Types', () => {
  // ============================================
  // truncateLabel Tests
  // ============================================
  describe('truncateLabel', () => {
    it('should return short strings unchanged', () => {
      const result = truncateLabel('Hello', 50)
      expect(result).toBe('Hello')
    })

    it('should truncate long strings with ellipsis', () => {
      const longText = 'This is a very long string that exceeds the maximum length'
      const result = truncateLabel(longText, 20)

      console.log(`[TEST] Truncated: "${result}"`)

      expect(result.length).toBe(20)
      expect(result.endsWith('...')).toBe(true)
    })

    it('should use default max length of 50', () => {
      const longText = 'A'.repeat(60)
      const result = truncateLabel(longText)

      expect(result.length).toBe(50)
    })

    it('should handle empty string', () => {
      const result = truncateLabel('')
      expect(result).toBe('')
    })

    it('should handle string exactly at max length', () => {
      const exactLength = 'A'.repeat(50)
      const result = truncateLabel(exactLength, 50)
      expect(result).toBe(exactLength)
    })
  })

  describe('generateGraphId', () => {
    it('generates prefixed graph ids for nodes and edges', () => {
      const nodeId = generateGraphId('gn')
      const edgeId = generateGraphId('ge')

      expect(nodeId).toMatch(/^gn_\d+_/)
      expect(edgeId).toMatch(/^ge_\d+_/)
      expect(nodeId).not.toBe(edgeId)
    })
  })

  // ============================================
  // isValidViewMode Tests
  // ============================================
  describe('isValidViewMode', () => {
    it('should return true for "traditional"', () => {
      expect(isValidViewMode('traditional')).toBe(true)
    })

    it('should return true for "graph"', () => {
      expect(isValidViewMode('graph')).toBe(true)
    })

    it('should return false for invalid strings', () => {
      expect(isValidViewMode('invalid')).toBe(false)
      expect(isValidViewMode('tree')).toBe(false)
      expect(isValidViewMode('3d')).toBe(false)
    })

    it('should return false for non-string values', () => {
      expect(isValidViewMode(null)).toBe(false)
      expect(isValidViewMode(undefined)).toBe(false)
      expect(isValidViewMode(123)).toBe(false)
      expect(isValidViewMode({})).toBe(false)
    })
  })

  // ============================================
  // Constants Tests
  // ============================================
  describe('Constants', () => {
    it('should have correct DEFAULT_GRAPH_FILTERS', () => {
      expect(DEFAULT_GRAPH_FILTERS).toEqual({
        showQuestions: true,
        showConcepts: true,
        showStashItems: true,
        showProbes: true,
      })
    })

    it('should have DEFAULT_VIEW_MODE as "traditional"', () => {
      expect(DEFAULT_VIEW_MODE).toBe('traditional')
    })

    it('should have NODE_SIZE_MULTIPLIERS for all types', () => {
      expect(NODE_SIZE_MULTIPLIERS.question).toBe(1.0)
      expect(NODE_SIZE_MULTIPLIERS.concept).toBe(0.5)
      expect(NODE_SIZE_MULTIPLIERS.stash).toBe(0.4)
      expect(NODE_SIZE_MULTIPLIERS.probe).toBe(0.7)
    })

    it('should have EDGE_WIDTHS for all edge types', () => {
      expect(EDGE_WIDTHS['question-child']).toBe(2)
      expect(EDGE_WIDTHS['question-concept']).toBe(1)
      expect(EDGE_WIDTHS['concept-related']).toBe(0.5)
      expect(EDGE_WIDTHS['stash-source']).toBe(1)
      expect(EDGE_WIDTHS['probe-stash']).toBe(1.5)
    })

    it('should have EDGE_STRENGTHS for all edge types', () => {
      expect(EDGE_STRENGTHS['question-child']).toBe(1.0)
      expect(EDGE_STRENGTHS['question-concept']).toBe(0.8)
      expect(EDGE_STRENGTHS['concept-related']).toBe(0.3)
      expect(EDGE_STRENGTHS['stash-source']).toBe(0.6)
      expect(EDGE_STRENGTHS['probe-stash']).toBe(0.7)
    })
  })

  // ============================================
  // Label Constants Tests
  // ============================================
  describe('Labels', () => {
    it('should have nodeTypeLabels for all node types', () => {
      expect(nodeTypeLabels.question).toBe('Question')
      expect(nodeTypeLabels.concept).toBe('Concept')
      expect(nodeTypeLabels.stash).toBe('Stash Item')
      expect(nodeTypeLabels.probe).toBe('Probe')
    })

    it('should have edgeTypeLabels for all edge types', () => {
      expect(edgeTypeLabels['question-child']).toBe('Child Question')
      expect(edgeTypeLabels['question-concept']).toBe('Contains Concept')
      expect(edgeTypeLabels['concept-related']).toBe('Related Concept')
      expect(edgeTypeLabels['stash-source']).toBe('From Source')
      expect(edgeTypeLabels['probe-stash']).toBe('Uses Item')
    })
  })
})
