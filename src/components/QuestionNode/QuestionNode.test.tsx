/**
 * QuestionNode Component Tests
 * ============================
 * 
 * Tests for the individual question node component.
 * 
 * Test Coverage:
 * - Basic rendering
 * - Question text display
 * - Root vs non-root styling
 * - Active state
 * - Expand/collapse button
 * - Add child functionality
 * - Click handling
 * 
 * These tests verify the question node displays and behaves correctly.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../../test/test-utils'
import { QuestionNode } from './QuestionNode'
import type { QuestionNode as QuestionNodeType } from '../../types/question'
import { createQuestionNode } from '../../types/question'

describe('QuestionNode Component', () => {
  
  // Create a test node
  let testNode: QuestionNodeType
  let mockOnSelect: ReturnType<typeof vi.fn>
  let mockOnAddChild: ReturnType<typeof vi.fn>
  let mockOnToggleExpand: ReturnType<typeof vi.fn>
  
  beforeEach(() => {
    testNode = createQuestionNode('What is consciousness?')
    mockOnSelect = vi.fn()
    mockOnAddChild = vi.fn()
    mockOnToggleExpand = vi.fn()
  })

  // ============================================
  // Basic Rendering Tests
  // ============================================
  describe('Basic Rendering', () => {
    it('should render the question text', () => {
      render(<QuestionNode node={testNode} />)
      
      const questionText = screen.getByText('What is consciousness?')
      
      console.log(`[TEST] Question text found: ${!!questionText}`)
      
      expect(questionText).toBeInTheDocument()
    })

    it('should render the question prefix', () => {
      render(<QuestionNode node={testNode} />)
      
      const prefix = screen.getByText('?')
      
      console.log(`[TEST] Prefix found: ${!!prefix}`)
      
      expect(prefix).toBeInTheDocument()
    })

    it('should render the add child button', () => {
      render(<QuestionNode node={testNode} />)
      
      const addButton = screen.getByRole('button', { name: /customize with your own question/i })
      
      console.log(`[TEST] Add button found: ${!!addButton}`)
      console.log(`[TEST] Add button text: ${addButton.textContent}`)
      
      expect(addButton).toBeInTheDocument()
      expect(addButton).toHaveTextContent('↳')
    })

    it('should have button role for the node', () => {
      render(<QuestionNode node={testNode} />)
      
      const nodeButton = screen.getByRole('button', { name: /question:/i })
      
      console.log(`[TEST] Node has button role: ${!!nodeButton}`)
      
      expect(nodeButton).toBeInTheDocument()
    })
  })

  // ============================================
  // Root Node Tests
  // ============================================
  describe('Root Node', () => {
    it('should apply root styling when isRoot is true', () => {
      render(<QuestionNode node={testNode} isRoot={true} />)
      
      const nodeButton = screen.getByRole('button', { name: /question:/i })
      
      console.log(`[TEST] Node classes: ${nodeButton.className}`)
      
      expect(nodeButton.className).toContain('root')
    })

    it('should not apply root styling when isRoot is false', () => {
      render(<QuestionNode node={testNode} isRoot={false} />)
      
      const nodeButton = screen.getByRole('button', { name: /question:/i })
      
      console.log(`[TEST] Node classes (non-root): ${nodeButton.className}`)
      
      expect(nodeButton.className).not.toContain('root')
    })
  })

  // ============================================
  // Active State Tests
  // ============================================
  describe('Active State', () => {
    it('should apply active styling when isActive is true', () => {
      render(<QuestionNode node={testNode} isActive={true} />)
      
      const nodeButton = screen.getByRole('button', { name: /question:/i })
      
      console.log(`[TEST] Node classes (active): ${nodeButton.className}`)
      
      expect(nodeButton.className).toContain('active')
    })

    it('should not apply active styling when isActive is false', () => {
      render(<QuestionNode node={testNode} isActive={false} />)
      
      const nodeButton = screen.getByRole('button', { name: /question:/i })
      
      console.log(`[TEST] Node classes (inactive): ${nodeButton.className}`)
      
      expect(nodeButton.className).not.toContain('active')
    })
  })

  // ============================================
  // Expand/Collapse Button Tests
  // ============================================
  describe('Expand/Collapse Button', () => {
    it('should not show expand button when hasChildren is false', () => {
      render(<QuestionNode node={testNode} hasChildren={false} />)
      
      const expandButton = screen.queryByRole('button', { name: /expand|collapse/i })
      
      console.log(`[TEST] Expand button visible (no children): ${!!expandButton}`)
      
      expect(expandButton).not.toBeInTheDocument()
    })

    it('should show expand button when hasChildren is true', () => {
      render(<QuestionNode node={testNode} hasChildren={true} />)
      
      const expandButton = screen.getByRole('button', { name: /collapse/i })
      
      console.log(`[TEST] Expand button visible (has children): ${!!expandButton}`)
      
      expect(expandButton).toBeInTheDocument()
    })

    it('should show minus sign when expanded', () => {
      const expandedNode = { ...testNode, meta: { ...testNode.meta, isExpanded: true } }
      render(<QuestionNode node={expandedNode} hasChildren={true} />)
      
      const expandButton = screen.getByRole('button', { name: /collapse/i })
      
      console.log(`[TEST] Expand button text (expanded): ${expandButton.textContent}`)
      
      expect(expandButton).toHaveTextContent('−')
    })

    it('should show plus sign when collapsed', () => {
      const collapsedNode = { ...testNode, meta: { ...testNode.meta, isExpanded: false } }
      render(<QuestionNode node={collapsedNode} hasChildren={true} />)
      
      const expandButton = screen.getByRole('button', { name: /expand/i })
      
      console.log(`[TEST] Expand button text (collapsed): ${expandButton.textContent}`)
      
      expect(expandButton).toHaveTextContent('+')
    })

    it('should call onToggleExpand when clicking expand button', async () => {
      const { user } = render(
        <QuestionNode 
          node={testNode} 
          hasChildren={true} 
          onToggleExpand={mockOnToggleExpand}
        />
      )
      
      const expandButton = screen.getByRole('button', { name: /collapse/i })
      await user.click(expandButton)
      
      console.log(`[TEST] onToggleExpand called: ${mockOnToggleExpand.mock.calls.length} time(s)`)
      console.log(`[TEST] onToggleExpand argument: ${mockOnToggleExpand.mock.calls[0]?.[0]}`)
      
      expect(mockOnToggleExpand).toHaveBeenCalledTimes(1)
      expect(mockOnToggleExpand).toHaveBeenCalledWith(testNode.id)
    })
  })

  // ============================================
  // Click Handling Tests
  // ============================================
  describe('Click Handling', () => {
    it('should call onSelect when clicking the node', async () => {
      const { user } = render(
        <QuestionNode node={testNode} onSelect={mockOnSelect} />
      )
      
      const nodeButton = screen.getByRole('button', { name: /question:/i })
      await user.click(nodeButton)
      
      console.log(`[TEST] onSelect called: ${mockOnSelect.mock.calls.length} time(s)`)
      console.log(`[TEST] onSelect argument: ${mockOnSelect.mock.calls[0]?.[0]}`)
      
      expect(mockOnSelect).toHaveBeenCalledTimes(1)
      expect(mockOnSelect).toHaveBeenCalledWith(testNode.id)
    })
  })

  // ============================================
  // Add Child Form Tests
  // ============================================
  describe('Add Child Form', () => {
    it('should show add child form when clicking add button', async () => {
      const { user } = render(<QuestionNode node={testNode} />)
      
      const addButton = screen.getByRole('button', { name: /customize with your own question/i })
      await user.click(addButton)
      
      const childInput = screen.getByPlaceholderText(/what comes next/i)
      
      console.log(`[TEST] Add child form visible: ${!!childInput}`)
      
      expect(childInput).toBeInTheDocument()
    })

    it('should show branch connector in add form', async () => {
      const { user } = render(<QuestionNode node={testNode} />)
      
      const addButton = screen.getByRole('button', { name: /customize with your own question/i })
      await user.click(addButton)
      
      const connector = screen.getByText('├─')
      
      console.log(`[TEST] Branch connector visible: ${!!connector}`)
      
      expect(connector).toBeInTheDocument()
    })

    it('should call onAddChild when submitting child question', async () => {
      const { user } = render(
        <QuestionNode node={testNode} onAddChild={mockOnAddChild} />
      )
      
      const addButton = screen.getByRole('button', { name: /customize with your own question/i })
      await user.click(addButton)
      
      const childInput = screen.getByPlaceholderText(/what comes next/i)
      await user.type(childInput, 'Is it emergent?')
      await user.keyboard('{Enter}')
      
      console.log(`[TEST] onAddChild called: ${mockOnAddChild.mock.calls.length} time(s)`)
      console.log(`[TEST] onAddChild arguments: ${JSON.stringify(mockOnAddChild.mock.calls[0])}`)
      
      expect(mockOnAddChild).toHaveBeenCalledTimes(1)
      expect(mockOnAddChild).toHaveBeenCalledWith(testNode.id, 'Is it emergent?')
    })

    it('should close add form after submitting', async () => {
      const { user } = render(
        <QuestionNode node={testNode} onAddChild={mockOnAddChild} />
      )
      
      const addButton = screen.getByRole('button', { name: /customize with your own question/i })
      await user.click(addButton)
      
      const childInput = screen.getByPlaceholderText(/what comes next/i)
      await user.type(childInput, 'Test')
      await user.keyboard('{Enter}')
      
      await waitFor(() => {
        const inputAfter = screen.queryByPlaceholderText(/what comes next/i)
        console.log(`[TEST] Form closed after submit: ${!inputAfter}`)
        expect(inputAfter).not.toBeInTheDocument()
      })
    })

    it('should close add form when pressing Escape', async () => {
      const { user } = render(<QuestionNode node={testNode} />)
      
      const addButton = screen.getByRole('button', { name: /customize with your own question/i })
      await user.click(addButton)
      
      screen.getByPlaceholderText(/what comes next/i)
      await user.keyboard('{Escape}')
      
      await waitFor(() => {
        const inputAfter = screen.queryByPlaceholderText(/what comes next/i)
        console.log(`[TEST] Form closed on Escape: ${!inputAfter}`)
        expect(inputAfter).not.toBeInTheDocument()
      })
    })

    it('should close add form when clicking cancel', async () => {
      const { user } = render(<QuestionNode node={testNode} />)
      
      const addButton = screen.getByRole('button', { name: /customize with your own question/i })
      await user.click(addButton)
      
      const cancelButton = screen.getByText('×')
      await user.click(cancelButton)
      
      await waitFor(() => {
        const inputAfter = screen.queryByPlaceholderText(/what comes next/i)
        console.log(`[TEST] Form closed on cancel: ${!inputAfter}`)
        expect(inputAfter).not.toBeInTheDocument()
      })
    })

    it('should not submit empty child question', async () => {
      const { user } = render(
        <QuestionNode node={testNode} onAddChild={mockOnAddChild} />
      )
      
      const addButton = screen.getByRole('button', { name: /customize with your own question/i })
      await user.click(addButton)
      
      screen.getByPlaceholderText(/what comes next/i)
      await user.keyboard('{Enter}')
      
      console.log(`[TEST] onAddChild not called for empty: ${mockOnAddChild.mock.calls.length === 0}`)
      
      expect(mockOnAddChild).not.toHaveBeenCalled()
    })
  })

  // ============================================
  // Accessibility Tests
  // ============================================
  describe('Accessibility', () => {
    it('should have aria-label with question text', () => {
      render(<QuestionNode node={testNode} />)
      
      const nodeButton = screen.getByRole('button', { name: /question: what is consciousness/i })
      
      console.log(`[TEST] aria-label: ${nodeButton.getAttribute('aria-label')}`)
      
      expect(nodeButton).toHaveAttribute('aria-label', `Question: ${testNode.text}`)
    })

    it('should have aria-expanded when has children', () => {
      render(<QuestionNode node={testNode} hasChildren={true} />)
      
      const nodeButton = screen.getByRole('button', { name: /question:/i })
      
      console.log(`[TEST] aria-expanded: ${nodeButton.getAttribute('aria-expanded')}`)
      
      expect(nodeButton).toHaveAttribute('aria-expanded', 'true')
    })

    it('should be focusable', () => {
      render(<QuestionNode node={testNode} />)
      
      const nodeButton = screen.getByRole('button', { name: /question:/i })
      
      console.log(`[TEST] tabIndex: ${nodeButton.getAttribute('tabindex')}`)
      
      expect(nodeButton).toHaveAttribute('tabindex', '0')
    })
  })
})
