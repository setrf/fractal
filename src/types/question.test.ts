/**
 * Question Types & Utilities Tests
 * =================================
 * 
 * Comprehensive tests for the question tree data structures and utilities.
 * 
 * Test Coverage:
 * - generateId(): Unique ID generation
 * - createEmptyTree(): Empty tree initialization
 * - createQuestionNode(): Node factory function
 * - addNodeToTree(): Tree mutation (immutable)
 * - getChildren(): Child node retrieval
 * - getPathToNode(): Ancestry path calculation
 * - getNodeDepth(): Depth calculation
 * 
 * These tests verify the core data layer that powers the entire application.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  QuestionTree,
  QuestionNode,
  createEmptyTree,
  generateId,
  createQuestionNode,
  addNodeToTree,
  getChildren,
  getPathToNode,
  getNodeDepth,
} from './question'

describe('Question Types & Utilities', () => {
  
  // ============================================
  // generateId() Tests
  // ============================================
  describe('generateId()', () => {
    it('should generate a string ID', () => {
      const id = generateId()
      console.log(`[TEST] Generated ID: ${id}`)
      
      expect(typeof id).toBe('string')
      expect(id.length).toBeGreaterThan(0)
    })

    it('should start with "q_" prefix', () => {
      const id = generateId()
      console.log(`[TEST] ID prefix check: ${id}`)
      
      expect(id.startsWith('q_')).toBe(true)
    })

    it('should generate unique IDs across multiple calls', () => {
      const ids = new Set<string>()
      const count = 100
      
      for (let i = 0; i < count; i++) {
        ids.add(generateId())
      }
      
      console.log(`[TEST] Generated ${count} IDs, unique count: ${ids.size}`)
      
      expect(ids.size).toBe(count)
    })

    it('should include timestamp component', () => {
      const before = Date.now()
      const id = generateId()
      const after = Date.now()
      
      // Extract timestamp from ID (format: q_TIMESTAMP_RANDOM)
      const parts = id.split('_')
      const timestamp = parseInt(parts[1], 10)
      
      console.log(`[TEST] Timestamp extraction: ${timestamp} (range: ${before}-${after})`)
      
      expect(timestamp).toBeGreaterThanOrEqual(before)
      expect(timestamp).toBeLessThanOrEqual(after)
    })
  })

  // ============================================
  // createEmptyTree() Tests
  // ============================================
  describe('createEmptyTree()', () => {
    it('should create a tree with empty nodes object', () => {
      const tree = createEmptyTree()
      console.log(`[TEST] Empty tree nodes:`, tree.nodes)
      
      expect(tree.nodes).toEqual({})
      expect(Object.keys(tree.nodes).length).toBe(0)
    })

    it('should create a tree with null rootId', () => {
      const tree = createEmptyTree()
      console.log(`[TEST] Empty tree rootId: ${tree.rootId}`)
      
      expect(tree.rootId).toBeNull()
    })

    it('should create a tree with null activeId', () => {
      const tree = createEmptyTree()
      console.log(`[TEST] Empty tree activeId: ${tree.activeId}`)
      
      expect(tree.activeId).toBeNull()
    })

    it('should create independent tree instances', () => {
      const tree1 = createEmptyTree()
      const tree2 = createEmptyTree()
      
      // Modify tree1
      tree1.nodes['test'] = {} as QuestionNode
      
      console.log(`[TEST] tree1 nodes count: ${Object.keys(tree1.nodes).length}`)
      console.log(`[TEST] tree2 nodes count: ${Object.keys(tree2.nodes).length}`)
      
      expect(Object.keys(tree1.nodes).length).toBe(1)
      expect(Object.keys(tree2.nodes).length).toBe(0)
    })
  })

  // ============================================
  // createQuestionNode() Tests
  // ============================================
  describe('createQuestionNode()', () => {
    it('should create a node with the provided text', () => {
      const text = 'What is the meaning of life?'
      const node = createQuestionNode(text)
      
      console.log(`[TEST] Node text: "${node.text}"`)
      
      expect(node.text).toBe(text)
    })

    it('should generate a unique ID for the node', () => {
      const node = createQuestionNode('Test question')
      
      console.log(`[TEST] Node ID: ${node.id}`)
      
      expect(node.id).toBeDefined()
      expect(node.id.startsWith('q_')).toBe(true)
    })

    it('should set parentId to null by default (root node)', () => {
      const node = createQuestionNode('Root question')
      
      console.log(`[TEST] Node parentId: ${node.parentId}`)
      
      expect(node.parentId).toBeNull()
    })

    it('should set parentId when provided', () => {
      const parentId = 'q_123_abc'
      const node = createQuestionNode('Child question', parentId)
      
      console.log(`[TEST] Node parentId: ${node.parentId}`)
      
      expect(node.parentId).toBe(parentId)
    })

    it('should initialize with empty childIds array', () => {
      const node = createQuestionNode('Test')
      
      console.log(`[TEST] Node childIds: ${JSON.stringify(node.childIds)}`)
      
      expect(node.childIds).toEqual([])
    })

    it('should set default position to origin', () => {
      const node = createQuestionNode('Test')
      
      console.log(`[TEST] Node position: ${JSON.stringify(node.position)}`)
      
      expect(node.position).toEqual({ x: 0, y: 0 })
    })

    it('should accept custom position', () => {
      const position = { x: 100, y: 200 }
      const node = createQuestionNode('Test', null, position)
      
      console.log(`[TEST] Custom position: ${JSON.stringify(node.position)}`)
      
      expect(node.position).toEqual(position)
    })

    it('should initialize metadata correctly', () => {
      const before = Date.now()
      const node = createQuestionNode('Test')
      const after = Date.now()
      
      console.log(`[TEST] Node metadata:`, node.meta)
      
      expect(node.meta.createdAt).toBeGreaterThanOrEqual(before)
      expect(node.meta.createdAt).toBeLessThanOrEqual(after)
      expect(node.meta.isExpanded).toBe(true)
      expect(node.meta.isActive).toBe(false)
      expect(node.meta.qualityScore).toBeNull()
    })
  })

  // ============================================
  // addNodeToTree() Tests
  // ============================================
  describe('addNodeToTree()', () => {
    let emptyTree: QuestionTree

    beforeEach(() => {
      emptyTree = createEmptyTree()
    })

    it('should add a root node to an empty tree', () => {
      const node = createQuestionNode('Root question')
      const newTree = addNodeToTree(emptyTree, node)
      
      console.log(`[TEST] Tree after adding root:`)
      console.log(`  - Node count: ${Object.keys(newTree.nodes).length}`)
      console.log(`  - rootId: ${newTree.rootId}`)
      console.log(`  - activeId: ${newTree.activeId}`)
      
      expect(newTree.nodes[node.id]).toBe(node)
      expect(newTree.rootId).toBe(node.id)
      expect(newTree.activeId).toBe(node.id)
    })

    it('should not mutate the original tree', () => {
      const node = createQuestionNode('Root')
      const newTree = addNodeToTree(emptyTree, node)
      
      console.log(`[TEST] Original tree nodes: ${Object.keys(emptyTree.nodes).length}`)
      console.log(`[TEST] New tree nodes: ${Object.keys(newTree.nodes).length}`)
      
      expect(Object.keys(emptyTree.nodes).length).toBe(0)
      expect(emptyTree.rootId).toBeNull()
      expect(Object.keys(newTree.nodes).length).toBe(1)
    })

    it('should add child node and update parent childIds', () => {
      const root = createQuestionNode('Root')
      let tree = addNodeToTree(emptyTree, root)
      
      const child = createQuestionNode('Child', root.id)
      tree = addNodeToTree(tree, child)
      
      const parentInTree = tree.nodes[root.id]
      
      console.log(`[TEST] Parent childIds: ${JSON.stringify(parentInTree.childIds)}`)
      console.log(`[TEST] Child in tree: ${tree.nodes[child.id]?.text}`)
      
      expect(parentInTree.childIds).toContain(child.id)
      expect(tree.nodes[child.id]).toBeDefined()
    })

    it('should preserve rootId when adding child nodes', () => {
      const root = createQuestionNode('Root')
      let tree = addNodeToTree(emptyTree, root)
      
      const child = createQuestionNode('Child', root.id)
      tree = addNodeToTree(tree, child)
      
      console.log(`[TEST] rootId after adding child: ${tree.rootId}`)
      
      expect(tree.rootId).toBe(root.id)
    })

    it('should set the new node as active', () => {
      const root = createQuestionNode('Root')
      let tree = addNodeToTree(emptyTree, root)
      
      expect(tree.activeId).toBe(root.id)
      
      const child = createQuestionNode('Child', root.id)
      tree = addNodeToTree(tree, child)
      
      console.log(`[TEST] activeId after adding child: ${tree.activeId}`)
      
      expect(tree.activeId).toBe(child.id)
    })

    it('should handle adding multiple children to same parent', () => {
      const root = createQuestionNode('Root')
      let tree = addNodeToTree(emptyTree, root)
      
      const child1 = createQuestionNode('Child 1', root.id)
      const child2 = createQuestionNode('Child 2', root.id)
      const child3 = createQuestionNode('Child 3', root.id)
      
      tree = addNodeToTree(tree, child1)
      tree = addNodeToTree(tree, child2)
      tree = addNodeToTree(tree, child3)
      
      const parent = tree.nodes[root.id]
      
      console.log(`[TEST] Parent childIds: ${JSON.stringify(parent.childIds)}`)
      
      expect(parent.childIds.length).toBe(3)
      expect(parent.childIds).toEqual([child1.id, child2.id, child3.id])
    })
  })

  // ============================================
  // getChildren() Tests
  // ============================================
  describe('getChildren()', () => {
    it('should return empty array for node with no children', () => {
      const root = createQuestionNode('Root')
      const tree = addNodeToTree(createEmptyTree(), root)
      
      const children = getChildren(tree, root.id)
      
      console.log(`[TEST] Children of childless node: ${JSON.stringify(children)}`)
      
      expect(children).toEqual([])
    })

    it('should return empty array for non-existent node', () => {
      const tree = createEmptyTree()
      
      const children = getChildren(tree, 'non-existent-id')
      
      console.log(`[TEST] Children of non-existent node: ${JSON.stringify(children)}`)
      
      expect(children).toEqual([])
    })

    it('should return all child nodes', () => {
      const root = createQuestionNode('Root')
      let tree = addNodeToTree(createEmptyTree(), root)
      
      const child1 = createQuestionNode('Child 1', root.id)
      const child2 = createQuestionNode('Child 2', root.id)
      
      tree = addNodeToTree(tree, child1)
      tree = addNodeToTree(tree, child2)
      
      const children = getChildren(tree, root.id)
      
      console.log(`[TEST] Children texts: ${children.map(c => c.text).join(', ')}`)
      
      expect(children.length).toBe(2)
      expect(children.map(c => c.id)).toContain(child1.id)
      expect(children.map(c => c.id)).toContain(child2.id)
    })

    it('should return QuestionNode objects, not just IDs', () => {
      const root = createQuestionNode('Root')
      let tree = addNodeToTree(createEmptyTree(), root)
      
      const child = createQuestionNode('Child', root.id)
      tree = addNodeToTree(tree, child)
      
      const children = getChildren(tree, root.id)
      
      console.log(`[TEST] Child object keys: ${Object.keys(children[0]).join(', ')}`)
      
      expect(children[0]).toHaveProperty('id')
      expect(children[0]).toHaveProperty('text')
      expect(children[0]).toHaveProperty('parentId')
      expect(children[0]).toHaveProperty('childIds')
      expect(children[0]).toHaveProperty('position')
      expect(children[0]).toHaveProperty('meta')
    })
  })

  // ============================================
  // getPathToNode() Tests
  // ============================================
  describe('getPathToNode()', () => {
    it('should return single-element array for root node', () => {
      const root = createQuestionNode('Root')
      const tree = addNodeToTree(createEmptyTree(), root)
      
      const path = getPathToNode(tree, root.id)
      
      console.log(`[TEST] Path to root: ${path.map(n => n.text).join(' -> ')}`)
      
      expect(path.length).toBe(1)
      expect(path[0].id).toBe(root.id)
    })

    it('should return empty array for non-existent node', () => {
      const tree = createEmptyTree()
      
      const path = getPathToNode(tree, 'non-existent')
      
      console.log(`[TEST] Path to non-existent: ${path.length} elements`)
      
      expect(path).toEqual([])
    })

    it('should return path from root to deep node', () => {
      const root = createQuestionNode('Root')
      let tree = addNodeToTree(createEmptyTree(), root)
      
      const child = createQuestionNode('Child', root.id)
      tree = addNodeToTree(tree, child)
      
      const grandchild = createQuestionNode('Grandchild', child.id)
      tree = addNodeToTree(tree, grandchild)
      
      const path = getPathToNode(tree, grandchild.id)
      
      console.log(`[TEST] Path to grandchild: ${path.map(n => n.text).join(' -> ')}`)
      
      expect(path.length).toBe(3)
      expect(path[0].text).toBe('Root')
      expect(path[1].text).toBe('Child')
      expect(path[2].text).toBe('Grandchild')
    })

    it('should return path in root-first order', () => {
      const root = createQuestionNode('1-Root')
      let tree = addNodeToTree(createEmptyTree(), root)
      
      const level2 = createQuestionNode('2-Level2', root.id)
      tree = addNodeToTree(tree, level2)
      
      const level3 = createQuestionNode('3-Level3', level2.id)
      tree = addNodeToTree(tree, level3)
      
      const level4 = createQuestionNode('4-Level4', level3.id)
      tree = addNodeToTree(tree, level4)
      
      const path = getPathToNode(tree, level4.id)
      
      console.log(`[TEST] Path order: ${path.map(n => n.text).join(' -> ')}`)
      
      expect(path[0].text).toBe('1-Root')
      expect(path[path.length - 1].text).toBe('4-Level4')
    })
  })

  // ============================================
  // getNodeDepth() Tests
  // ============================================
  describe('getNodeDepth()', () => {
    it('should return 0 for root node', () => {
      const root = createQuestionNode('Root')
      const tree = addNodeToTree(createEmptyTree(), root)
      
      const depth = getNodeDepth(tree, root.id)
      
      console.log(`[TEST] Root depth: ${depth}`)
      
      expect(depth).toBe(0)
    })

    it('should return 0 for non-existent node', () => {
      const tree = createEmptyTree()
      
      const depth = getNodeDepth(tree, 'non-existent')
      
      console.log(`[TEST] Non-existent node depth: ${depth}`)
      
      expect(depth).toBe(0)
    })

    it('should return correct depth for nested nodes', () => {
      const root = createQuestionNode('Root')
      let tree = addNodeToTree(createEmptyTree(), root)
      
      const level1 = createQuestionNode('Level 1', root.id)
      tree = addNodeToTree(tree, level1)
      
      const level2 = createQuestionNode('Level 2', level1.id)
      tree = addNodeToTree(tree, level2)
      
      const level3 = createQuestionNode('Level 3', level2.id)
      tree = addNodeToTree(tree, level3)
      
      console.log(`[TEST] Depths: root=${getNodeDepth(tree, root.id)}, ` +
        `l1=${getNodeDepth(tree, level1.id)}, ` +
        `l2=${getNodeDepth(tree, level2.id)}, ` +
        `l3=${getNodeDepth(tree, level3.id)}`)
      
      expect(getNodeDepth(tree, root.id)).toBe(0)
      expect(getNodeDepth(tree, level1.id)).toBe(1)
      expect(getNodeDepth(tree, level2.id)).toBe(2)
      expect(getNodeDepth(tree, level3.id)).toBe(3)
    })

    it('should return same depth for siblings', () => {
      const root = createQuestionNode('Root')
      let tree = addNodeToTree(createEmptyTree(), root)
      
      const sibling1 = createQuestionNode('Sibling 1', root.id)
      const sibling2 = createQuestionNode('Sibling 2', root.id)
      const sibling3 = createQuestionNode('Sibling 3', root.id)
      
      tree = addNodeToTree(tree, sibling1)
      tree = addNodeToTree(tree, sibling2)
      tree = addNodeToTree(tree, sibling3)
      
      console.log(`[TEST] Sibling depths: ` +
        `s1=${getNodeDepth(tree, sibling1.id)}, ` +
        `s2=${getNodeDepth(tree, sibling2.id)}, ` +
        `s3=${getNodeDepth(tree, sibling3.id)}`)
      
      expect(getNodeDepth(tree, sibling1.id)).toBe(1)
      expect(getNodeDepth(tree, sibling2.id)).toBe(1)
      expect(getNodeDepth(tree, sibling3.id)).toBe(1)
    })
  })
})
