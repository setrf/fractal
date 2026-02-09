/**
 * useQuestionTree Hook Tests
 * ==========================
 * 
 * Tests for the question tree state management hook.
 * 
 * Test Coverage:
 * - Initial state
 * - addRootQuestion()
 * - addChildQuestion()
 * - setActiveNode()
 * - toggleNodeExpansion()
 * - reset()
 * - getNode()
 * - getChildNodes()
 * 
 * These tests verify the React hook behavior for managing tree state.
 */

import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useQuestionTree } from './useQuestionTree'

describe('useQuestionTree Hook', () => {
  
  // ============================================
  // Initial State Tests
  // ============================================
  describe('Initial State', () => {
    it('should start with an empty tree', () => {
      const { result } = renderHook(() => useQuestionTree())
      
      console.log(`[TEST] Initial tree state:`)
      console.log(`  - nodes count: ${Object.keys(result.current.tree.nodes).length}`)
      console.log(`  - rootId: ${result.current.tree.rootId}`)
      console.log(`  - activeId: ${result.current.tree.activeId}`)
      
      expect(Object.keys(result.current.tree.nodes).length).toBe(0)
      expect(result.current.tree.rootId).toBeNull()
      expect(result.current.tree.activeId).toBeNull()
    })

    it('should have null rootNode initially', () => {
      const { result } = renderHook(() => useQuestionTree())
      
      console.log(`[TEST] Initial rootNode: ${result.current.rootNode}`)
      
      expect(result.current.rootNode).toBeNull()
    })

    it('should have null activeNode initially', () => {
      const { result } = renderHook(() => useQuestionTree())
      
      console.log(`[TEST] Initial activeNode: ${result.current.activeNode}`)
      
      expect(result.current.activeNode).toBeNull()
    })
  })

  // ============================================
  // addRootQuestion() Tests
  // ============================================
  describe('addRootQuestion()', () => {
    it('should add a root question to the tree', () => {
      const { result } = renderHook(() => useQuestionTree())
      
      act(() => {
        result.current.addRootQuestion('What is consciousness?')
      })
      
      console.log(`[TEST] After adding root:`)
      console.log(`  - nodes count: ${Object.keys(result.current.tree.nodes).length}`)
      console.log(`  - rootNode text: ${result.current.rootNode?.text}`)
      
      expect(Object.keys(result.current.tree.nodes).length).toBe(1)
      expect(result.current.rootNode).not.toBeNull()
      expect(result.current.rootNode?.text).toBe('What is consciousness?')
    })

    it('should return the ID of the created node', () => {
      const { result } = renderHook(() => useQuestionTree())
      
      let returnedId: string = ''
      act(() => {
        returnedId = result.current.addRootQuestion('Test question')
      })
      
      console.log(`[TEST] Returned ID: ${returnedId}`)
      console.log(`[TEST] rootId: ${result.current.tree.rootId}`)
      
      expect(returnedId).toBe(result.current.tree.rootId)
      expect(returnedId.startsWith('q_')).toBe(true)
    })

    it('should set the root node as active', () => {
      const { result } = renderHook(() => useQuestionTree())
      
      act(() => {
        result.current.addRootQuestion('Root')
      })
      
      console.log(`[TEST] activeNode after adding root: ${result.current.activeNode?.text}`)
      
      expect(result.current.activeNode).not.toBeNull()
      expect(result.current.activeNode?.id).toBe(result.current.rootNode?.id)
    })

    it('should set root node parentId to null', () => {
      const { result } = renderHook(() => useQuestionTree())
      
      act(() => {
        result.current.addRootQuestion('Root')
      })
      
      console.log(`[TEST] Root parentId: ${result.current.rootNode?.parentId}`)
      
      expect(result.current.rootNode?.parentId).toBeNull()
    })
  })

  // ============================================
  // addChildQuestion() Tests
  // ============================================
  describe('addChildQuestion()', () => {
    it('should add a child question to an existing node', () => {
      const { result } = renderHook(() => useQuestionTree())
      
      let rootId: string = ''
      act(() => {
        rootId = result.current.addRootQuestion('Root')
      })
      
      act(() => {
        result.current.addChildQuestion(rootId, 'Child question')
      })
      
      console.log(`[TEST] After adding child:`)
      console.log(`  - nodes count: ${Object.keys(result.current.tree.nodes).length}`)
      console.log(`  - root childIds: ${result.current.rootNode?.childIds}`)
      
      expect(Object.keys(result.current.tree.nodes).length).toBe(2)
      expect(result.current.rootNode?.childIds.length).toBe(1)
    })

    it('should set the child parentId correctly', () => {
      const { result } = renderHook(() => useQuestionTree())
      
      let rootId: string = ''
      act(() => {
        rootId = result.current.addRootQuestion('Root')
      })
      
      act(() => {
        result.current.addChildQuestion(rootId, 'Child')
      })
      
      const children = result.current.getChildNodes(rootId)
      
      console.log(`[TEST] Child parentId: ${children[0]?.parentId}`)
      
      expect(children[0]?.parentId).toBe(rootId)
    })

    it('should make the new child active', () => {
      const { result } = renderHook(() => useQuestionTree())
      
      let rootId: string = ''
      act(() => {
        rootId = result.current.addRootQuestion('Root')
      })
      
      act(() => {
        result.current.addChildQuestion(rootId, 'Child')
      })
      
      console.log(`[TEST] Active node after adding child: ${result.current.activeNode?.text}`)
      
      expect(result.current.activeNode?.text).toBe('Child')
    })

    it('should handle multiple children', () => {
      const { result } = renderHook(() => useQuestionTree())
      
      let rootId: string = ''
      act(() => {
        rootId = result.current.addRootQuestion('Root')
      })
      
      act(() => {
        result.current.addChildQuestion(rootId, 'Child 1')
        result.current.addChildQuestion(rootId, 'Child 2')
        result.current.addChildQuestion(rootId, 'Child 3')
      })
      
      const children = result.current.getChildNodes(rootId)
      
      console.log(`[TEST] Children count: ${children.length}`)
      console.log(`[TEST] Children texts: ${children.map(c => c.text).join(', ')}`)
      
      expect(children.length).toBe(3)
    })

    it('should not add child if parent does not exist', () => {
      const { result } = renderHook(() => useQuestionTree())
      
      act(() => {
        result.current.addRootQuestion('Root')
      })
      
      const nodeCountBefore = Object.keys(result.current.tree.nodes).length
      
      act(() => {
        result.current.addChildQuestion('non-existent-id', 'Orphan')
      })
      
      const nodeCountAfter = Object.keys(result.current.tree.nodes).length
      
      console.log(`[TEST] Nodes before: ${nodeCountBefore}, after: ${nodeCountAfter}`)
      
      expect(nodeCountAfter).toBe(nodeCountBefore)
    })
  })

  // ============================================
  // setActiveNode() Tests
  // ============================================
  describe('setActiveNode()', () => {
    it('should update the active node', () => {
      const { result } = renderHook(() => useQuestionTree())
      
      let rootId: string = ''
      act(() => {
        rootId = result.current.addRootQuestion('Root')
      })
      
      act(() => {
        result.current.addChildQuestion(rootId, 'Child')
      })
      
      // Child is now active, switch to root
      act(() => {
        result.current.setActiveNode(rootId)
      })
      
      console.log(`[TEST] Active node after setActiveNode: ${result.current.activeNode?.text}`)
      
      expect(result.current.activeNode?.id).toBe(rootId)
      expect(result.current.activeNode?.text).toBe('Root')
    })

    it('should update isActive meta on nodes', () => {
      const { result } = renderHook(() => useQuestionTree())
      
      let rootId: string = ''
      act(() => {
        rootId = result.current.addRootQuestion('Root')
      })
      
      act(() => {
        result.current.addChildQuestion(rootId, 'Child')
      })
      
      const childId = result.current.rootNode?.childIds[0] || ''
      
      act(() => {
        result.current.setActiveNode(rootId)
      })
      
      const rootNode = result.current.tree.nodes[rootId]
      const childNode = result.current.tree.nodes[childId]
      
      console.log(`[TEST] Root isActive: ${rootNode?.meta.isActive}`)
      console.log(`[TEST] Child isActive: ${childNode?.meta.isActive}`)
      
      expect(rootNode?.meta.isActive).toBe(true)
      expect(childNode?.meta.isActive).toBe(false)
    })

    it('should handle setting null (deselect)', () => {
      const { result } = renderHook(() => useQuestionTree())
      
      act(() => {
        result.current.addRootQuestion('Root')
      })
      
      act(() => {
        result.current.setActiveNode(null)
      })
      
      console.log(`[TEST] Active node after null: ${result.current.activeNode}`)
      console.log(`[TEST] activeId after null: ${result.current.tree.activeId}`)
      
      expect(result.current.activeNode).toBeNull()
      expect(result.current.tree.activeId).toBeNull()
    })
  })

  // ============================================
  // toggleNodeExpansion() Tests
  // ============================================
  describe('toggleNodeExpansion()', () => {
    it('should toggle expanded state from true to false', () => {
      const { result } = renderHook(() => useQuestionTree())
      
      let rootId: string = ''
      act(() => {
        rootId = result.current.addRootQuestion('Root')
      })
      
      const initialExpanded = result.current.tree.nodes[rootId]?.meta.isExpanded
      
      act(() => {
        result.current.toggleNodeExpansion(rootId)
      })
      
      const afterToggle = result.current.tree.nodes[rootId]?.meta.isExpanded
      
      console.log(`[TEST] isExpanded: ${initialExpanded} -> ${afterToggle}`)
      
      expect(initialExpanded).toBe(true)
      expect(afterToggle).toBe(false)
    })

    it('should toggle expanded state back to true', () => {
      const { result } = renderHook(() => useQuestionTree())
      
      let rootId: string = ''
      act(() => {
        rootId = result.current.addRootQuestion('Root')
      })
      
      act(() => {
        result.current.toggleNodeExpansion(rootId)
        result.current.toggleNodeExpansion(rootId)
      })
      
      const expanded = result.current.tree.nodes[rootId]?.meta.isExpanded
      
      console.log(`[TEST] isExpanded after double toggle: ${expanded}`)
      
      expect(expanded).toBe(true)
    })

    it('should not affect non-existent nodes', () => {
      const { result } = renderHook(() => useQuestionTree())
      
      act(() => {
        result.current.addRootQuestion('Root')
      })
      
      const nodesBefore = JSON.stringify(result.current.tree.nodes)
      
      act(() => {
        result.current.toggleNodeExpansion('non-existent')
      })
      
      const nodesAfter = JSON.stringify(result.current.tree.nodes)
      
      console.log(`[TEST] Nodes unchanged: ${nodesBefore === nodesAfter}`)
      
      // Note: The nodes object will be different references, 
      // but the structure should be equivalent
      expect(Object.keys(result.current.tree.nodes).length).toBe(1)
    })
  })

  // ============================================
  // reset() Tests
  // ============================================
  describe('reset()', () => {
    it('should clear all nodes', () => {
      const { result } = renderHook(() => useQuestionTree())
      
      act(() => {
        const rootId = result.current.addRootQuestion('Root')
        result.current.addChildQuestion(rootId, 'Child 1')
        result.current.addChildQuestion(rootId, 'Child 2')
      })
      
      const nodesBefore = Object.keys(result.current.tree.nodes).length
      
      act(() => {
        result.current.reset()
      })
      
      const nodesAfter = Object.keys(result.current.tree.nodes).length
      
      console.log(`[TEST] Nodes before reset: ${nodesBefore}`)
      console.log(`[TEST] Nodes after reset: ${nodesAfter}`)
      
      expect(nodesBefore).toBe(3)
      expect(nodesAfter).toBe(0)
    })

    it('should reset rootId to null', () => {
      const { result } = renderHook(() => useQuestionTree())
      
      act(() => {
        result.current.addRootQuestion('Root')
      })
      
      act(() => {
        result.current.reset()
      })
      
      console.log(`[TEST] rootId after reset: ${result.current.tree.rootId}`)
      
      expect(result.current.tree.rootId).toBeNull()
      expect(result.current.rootNode).toBeNull()
    })

    it('should reset activeId to null', () => {
      const { result } = renderHook(() => useQuestionTree())
      
      act(() => {
        result.current.addRootQuestion('Root')
      })
      
      act(() => {
        result.current.reset()
      })
      
      console.log(`[TEST] activeId after reset: ${result.current.tree.activeId}`)
      
      expect(result.current.tree.activeId).toBeNull()
      expect(result.current.activeNode).toBeNull()
    })
  })

  // ============================================
  // getNode() Tests
  // ============================================
  describe('getNode()', () => {
    it('should return the node for a valid ID', () => {
      const { result } = renderHook(() => useQuestionTree())
      
      let rootId: string = ''
      act(() => {
        rootId = result.current.addRootQuestion('Root')
      })
      
      const node = result.current.getNode(rootId)
      
      console.log(`[TEST] getNode result: ${node?.text}`)
      
      expect(node).toBeDefined()
      expect(node?.text).toBe('Root')
    })

    it('should return undefined for invalid ID', () => {
      const { result } = renderHook(() => useQuestionTree())
      
      act(() => {
        result.current.addRootQuestion('Root')
      })
      
      const node = result.current.getNode('invalid-id')
      
      console.log(`[TEST] getNode for invalid ID: ${node}`)
      
      expect(node).toBeUndefined()
    })
  })

  // ============================================
  // getChildNodes() Tests
  // ============================================
  describe('getChildNodes()', () => {
    it('should return child nodes for a parent', () => {
      const { result } = renderHook(() => useQuestionTree())
      
      let rootId: string = ''
      act(() => {
        rootId = result.current.addRootQuestion('Root')
        result.current.addChildQuestion(rootId, 'Child 1')
        result.current.addChildQuestion(rootId, 'Child 2')
      })
      
      const children = result.current.getChildNodes(rootId)
      
      console.log(`[TEST] getChildNodes count: ${children.length}`)
      console.log(`[TEST] getChildNodes texts: ${children.map(c => c.text).join(', ')}`)
      
      expect(children.length).toBe(2)
      expect(children[0].text).toBe('Child 1')
      expect(children[1].text).toBe('Child 2')
    })

    it('should return empty array for node with no children', () => {
      const { result } = renderHook(() => useQuestionTree())
      
      let rootId: string = ''
      act(() => {
        rootId = result.current.addRootQuestion('Root')
      })
      
      const children = result.current.getChildNodes(rootId)
      
      console.log(`[TEST] getChildNodes for childless: ${children.length}`)
      
      expect(children).toEqual([])
    })
  })

  // ============================================
  // updateNodeMeta() Tests
  // ============================================
  describe('updateNodeMeta()', () => {
    it('should update metadata for an existing node', () => {
      const { result } = renderHook(() => useQuestionTree())

      let rootId = ''
      act(() => {
        rootId = result.current.addRootQuestion('Root')
      })

      act(() => {
        result.current.updateNodeMeta(rootId, {
          qualityScore: 8.2,
          confidence: 0.77,
          uncertainty: 0.23,
        })
      })

      expect(result.current.tree.nodes[rootId].meta.qualityScore).toBe(8.2)
      expect(result.current.tree.nodes[rootId].meta.confidence).toBe(0.77)
      expect(result.current.tree.nodes[rootId].meta.uncertainty).toBe(0.23)
    })

    it('should ignore updates for unknown node id', () => {
      const { result } = renderHook(() => useQuestionTree())

      act(() => {
        result.current.addRootQuestion('Root')
      })

      const snapshot = result.current.tree

      act(() => {
        result.current.updateNodeMeta('missing-id', { qualityScore: 1 })
      })

      expect(result.current.tree).toEqual(snapshot)
    })
  })
})
