/**
 * useGraphData Hook Tests
 * ========================
 *
 * Tests for the graph data aggregation hook.
 *
 * Test Coverage:
 * - Empty state handling
 * - Question node transformation
 * - Concept node transformation
 * - Stash item node transformation
 * - Probe node transformation
 * - Edge creation for relationships
 * - Node count tracking
 * - Filter functionality
 */

import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useGraphData } from './useGraphData'
import { createEmptyTree, createQuestionNode, addNodeToTree } from '../types/question'
import type { ExtractedConcept } from '../types/concept'
import type { StashItem } from '../types/stash'
import type { Probe } from '../types/probe'

describe('useGraphData Hook', () => {
  // ============================================
  // Empty State Tests
  // ============================================
  describe('Empty State', () => {
    it('should return empty arrays when no data exists', () => {
      const { result } = renderHook(() =>
        useGraphData({
          tree: createEmptyTree(),
          nodeConcepts: {},
          stashItems: [],
          probes: [],
        })
      )

      expect(result.current.nodes).toHaveLength(0)
      expect(result.current.edges).toHaveLength(0)
      expect(result.current.counts).toEqual({
        question: 0,
        concept: 0,
        stash: 0,
        probe: 0,
      })
    })

    it('should set isLoading to false', () => {
      const { result } = renderHook(() =>
        useGraphData({
          tree: createEmptyTree(),
          nodeConcepts: {},
          stashItems: [],
          probes: [],
        })
      )

      expect(result.current.isLoading).toBe(false)
    })
  })

  // ============================================
  // Question Node Tests
  // ============================================
  describe('Question Nodes', () => {
    it('should create nodes for questions', () => {
      const tree = createEmptyTree()
      const rootNode = createQuestionNode('What is consciousness?')
      const treeWithRoot = addNodeToTree(tree, rootNode)

      const { result } = renderHook(() =>
        useGraphData({
          tree: treeWithRoot,
          nodeConcepts: {},
          stashItems: [],
          probes: [],
        })
      )

      console.log(`[TEST] Nodes: ${result.current.nodes.length}`)

      expect(result.current.nodes).toHaveLength(1)
      expect(result.current.nodes[0].type).toBe('question')
      expect(result.current.nodes[0].id).toBe(rootNode.id)
      expect(result.current.counts.question).toBe(1)
    })

    it('should create edges for parent-child relationships', () => {
      let tree = createEmptyTree()
      const rootNode = createQuestionNode('What is consciousness?')
      tree = addNodeToTree(tree, rootNode)

      const childNode = createQuestionNode('Is it emergent?', rootNode.id)
      tree = addNodeToTree(tree, childNode)

      const { result } = renderHook(() =>
        useGraphData({
          tree,
          nodeConcepts: {},
          stashItems: [],
          probes: [],
        })
      )

      console.log(`[TEST] Edges: ${result.current.edges.length}`)

      expect(result.current.nodes).toHaveLength(2)
      expect(result.current.edges).toHaveLength(1)
      expect(result.current.edges[0].type).toBe('question-child')
      expect(result.current.edges[0].source).toBe(rootNode.id)
      expect(result.current.edges[0].target).toBe(childNode.id)
    })

    it('should assign nodes to a group based on root', () => {
      let tree = createEmptyTree()
      const rootNode = createQuestionNode('What is consciousness?')
      tree = addNodeToTree(tree, rootNode)

      const childNode = createQuestionNode('Is it emergent?', rootNode.id)
      tree = addNodeToTree(tree, childNode)

      const { result } = renderHook(() =>
        useGraphData({
          tree,
          nodeConcepts: {},
          stashItems: [],
          probes: [],
        })
      )

      // All nodes should be in the same group (root's group)
      expect(result.current.nodes[0].group).toBe(rootNode.id)
      expect(result.current.nodes[1].group).toBe(rootNode.id)
    })
  })

  // ============================================
  // Concept Node Tests
  // ============================================
  describe('Concept Nodes', () => {
    it('should create nodes for concepts', () => {
      let tree = createEmptyTree()
      const rootNode = createQuestionNode('What is evolution?')
      tree = addNodeToTree(tree, rootNode)

      const concepts: Record<string, ExtractedConcept[]> = {
        [rootNode.id]: [
          {
            id: 'c_123',
            text: 'evolution',
            normalizedName: 'evolution',
            category: 'science',
            startIndex: 8,
            endIndex: 17,
          },
        ],
      }

      const { result } = renderHook(() =>
        useGraphData({
          tree,
          nodeConcepts: concepts,
          stashItems: [],
          probes: [],
        })
      )

      console.log(`[TEST] Concept nodes: ${result.current.counts.concept}`)

      expect(result.current.counts.concept).toBe(1)

      const conceptNode = result.current.nodes.find((n) => n.type === 'concept')
      expect(conceptNode).toBeDefined()
      expect(conceptNode?.label).toBe('evolution')
    })

    it('should deduplicate concepts by normalized name', () => {
      let tree = createEmptyTree()
      const rootNode = createQuestionNode('What is evolution?')
      tree = addNodeToTree(tree, rootNode)
      const childNode = createQuestionNode('How does evolution work?', rootNode.id)
      tree = addNodeToTree(tree, childNode)

      const concepts: Record<string, ExtractedConcept[]> = {
        [rootNode.id]: [
          {
            id: 'c_123',
            text: 'evolution',
            normalizedName: 'evolution',
            category: 'science',
            startIndex: 8,
            endIndex: 17,
          },
        ],
        [childNode.id]: [
          {
            id: 'c_456',
            text: 'evolution',
            normalizedName: 'evolution',
            category: 'science',
            startIndex: 9,
            endIndex: 18,
          },
        ],
      }

      const { result } = renderHook(() =>
        useGraphData({
          tree,
          nodeConcepts: concepts,
          stashItems: [],
          probes: [],
        })
      )

      console.log(`[TEST] Deduplicated concept nodes: ${result.current.counts.concept}`)

      // Should only have 1 concept node despite 2 mentions
      expect(result.current.counts.concept).toBe(1)

      // But should have 2 edges (one from each question)
      const conceptEdges = result.current.edges.filter((e) => e.type === 'question-concept')
      expect(conceptEdges).toHaveLength(2)
    })
  })

  // ============================================
  // Stash Item Tests
  // ============================================
  describe('Stash Item Nodes', () => {
    it('should create nodes for stash items', () => {
      const stashItems: StashItem[] = [
        {
          id: 's_123',
          type: 'note',
          content: 'Important insight about consciousness',
          metadata: { title: 'My Note' },
          createdAt: Date.now(),
        },
      ]

      const { result } = renderHook(() =>
        useGraphData({
          tree: createEmptyTree(),
          nodeConcepts: {},
          stashItems,
          probes: [],
        })
      )

      console.log(`[TEST] Stash nodes: ${result.current.counts.stash}`)

      expect(result.current.counts.stash).toBe(1)

      const stashNode = result.current.nodes.find((n) => n.type === 'stash')
      expect(stashNode).toBeDefined()
      expect(stashNode?.id).toBe('s_123')
    })

    it('creates stash-source edges for highlight->concept and question->question links', () => {
      let tree = createEmptyTree()
      const root = createQuestionNode('What drives learning?')
      tree = addNodeToTree(tree, root)

      const nodeConcepts: Record<string, ExtractedConcept[]> = {
        [root.id]: [
          {
            id: 'c_learning',
            text: 'learning',
            normalizedName: 'learning',
            category: 'science',
            startIndex: 12,
            endIndex: 20,
          },
        ],
      }

      const stashItems: StashItem[] = [
        {
          id: 's_highlight',
          type: 'highlight',
          content: 'learning',
          metadata: { normalizedName: 'Learning' },
          createdAt: Date.now(),
        },
        {
          id: 's_question',
          type: 'question',
          content: 'Follow-up',
          metadata: { questionId: root.id },
          createdAt: Date.now(),
        },
      ]

      const { result } = renderHook(() =>
        useGraphData({
          tree,
          nodeConcepts,
          stashItems,
          probes: [],
        })
      )

      const stashSourceEdges = result.current.edges.filter((edge) => edge.type === 'stash-source')
      expect(stashSourceEdges.some((edge) => edge.source === 'c_learning' && edge.target === 's_highlight')).toBe(true)
      expect(stashSourceEdges.some((edge) => edge.source === root.id && edge.target === 's_question')).toBe(true)
    })
  })

  // ============================================
  // Probe Tests
  // ============================================
  describe('Probe Nodes', () => {
    it('should create nodes for probes', () => {
      const probes: Probe[] = [
        {
          id: 'p_123',
          name: 'My Probe',
          color: 'blue',
          messages: [],
          selectedStashItemIds: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ]

      const { result } = renderHook(() =>
        useGraphData({
          tree: createEmptyTree(),
          nodeConcepts: {},
          stashItems: [],
          probes,
        })
      )

      console.log(`[TEST] Probe nodes: ${result.current.counts.probe}`)

      expect(result.current.counts.probe).toBe(1)

      const probeNode = result.current.nodes.find((n) => n.type === 'probe')
      expect(probeNode).toBeDefined()
      expect(probeNode?.label).toBe('My Probe')
    })

    it('should create edges between probes and selected stash items', () => {
      const stashItems: StashItem[] = [
        {
          id: 's_123',
          type: 'note',
          content: 'Note content',
          metadata: {},
          createdAt: Date.now(),
        },
      ]

      const probes: Probe[] = [
        {
          id: 'p_123',
          name: 'My Probe',
          color: 'blue',
          messages: [],
          selectedStashItemIds: ['s_123'],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ]

      const { result } = renderHook(() =>
        useGraphData({
          tree: createEmptyTree(),
          nodeConcepts: {},
          stashItems,
          probes,
        })
      )

      const probeEdges = result.current.edges.filter((e) => e.type === 'probe-stash')

      console.log(`[TEST] Probe-stash edges: ${probeEdges.length}`)

      expect(probeEdges).toHaveLength(1)
      expect(probeEdges[0].source).toBe('p_123')
      expect(probeEdges[0].target).toBe('s_123')
    })
  })

  // ============================================
  // Filter Tests
  // ============================================
  describe('Filters', () => {
    it('should hide questions when filter is off', () => {
      let tree = createEmptyTree()
      const rootNode = createQuestionNode('What is consciousness?')
      tree = addNodeToTree(tree, rootNode)

      const { result } = renderHook(() =>
        useGraphData({
          tree,
          nodeConcepts: {},
          stashItems: [],
          probes: [],
          filters: {
            showQuestions: false,
            showConcepts: true,
            showStashItems: true,
            showProbes: true,
          },
        })
      )

      console.log(`[TEST] Nodes with questions hidden: ${result.current.nodes.length}`)

      expect(result.current.counts.question).toBe(0)
      expect(result.current.nodes).toHaveLength(0)
    })

    it('should hide concepts when filter is off', () => {
      let tree = createEmptyTree()
      const rootNode = createQuestionNode('What is evolution?')
      tree = addNodeToTree(tree, rootNode)

      const concepts: Record<string, ExtractedConcept[]> = {
        [rootNode.id]: [
          {
            id: 'c_123',
            text: 'evolution',
            normalizedName: 'evolution',
            category: 'science',
            startIndex: 8,
            endIndex: 17,
          },
        ],
      }

      const { result } = renderHook(() =>
        useGraphData({
          tree,
          nodeConcepts: concepts,
          stashItems: [],
          probes: [],
          filters: {
            showQuestions: true,
            showConcepts: false,
            showStashItems: true,
            showProbes: true,
          },
        })
      )

      console.log(`[TEST] Nodes with concepts hidden: ${result.current.counts.concept}`)

      expect(result.current.counts.concept).toBe(0)
      expect(result.current.counts.question).toBe(1)
    })
  })

  // ============================================
  // GraphData Structure Tests
  // ============================================
  describe('GraphData Structure', () => {
    it('should provide graphData in react-force-graph format', () => {
      let tree = createEmptyTree()
      const rootNode = createQuestionNode('What is consciousness?')
      tree = addNodeToTree(tree, rootNode)

      const { result } = renderHook(() =>
        useGraphData({
          tree,
          nodeConcepts: {},
          stashItems: [],
          probes: [],
        })
      )

      expect(result.current.graphData).toBeDefined()
      expect(result.current.graphData.nodes).toBe(result.current.nodes)
      expect(result.current.graphData.edges).toBe(result.current.edges)
    })
  })
})
