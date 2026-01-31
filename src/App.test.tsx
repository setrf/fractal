/**
 * App Integration Tests
 * =====================
 * 
 * End-to-end integration tests for the main App component.
 * 
 * Test Coverage:
 * - Initial render (welcome view)
 * - Question submission flow
 * - Tree view rendering
 * - Adding child questions
 * - Reset functionality
 * - Theme toggle
 * 
 * These tests verify the complete user journey through the application.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, userEvent, waitFor, logAccessibleElements } from './test/test-utils'
import App from './App'
import { localStorageMock } from './test/setup'

describe('App Integration Tests', () => {
  
  beforeEach(() => {
    localStorageMock.clear()
    document.documentElement.removeAttribute('data-theme')
  })

  // ============================================
  // Initial Render Tests
  // ============================================
  describe('Initial Render (Welcome View)', () => {
    it('should display the app title', () => {
      render(<App />)
      
      const title = screen.getByRole('heading', { name: /fractal/i })
      
      console.log(`[TEST] Title found: ${!!title}`)
      console.log(`[TEST] Title text: ${title.textContent}`)
      
      expect(title).toBeInTheDocument()
    })

    it('should display the tagline', () => {
      render(<App />)
      
      const tagline = screen.getByText(/a place for questions, not answers/i)
      
      console.log(`[TEST] Tagline found: ${!!tagline}`)
      
      expect(tagline).toBeInTheDocument()
    })

    it('should display the question input', () => {
      render(<App />)
      
      const input = screen.getByRole('textbox', { name: /enter your question/i })
      
      console.log(`[TEST] Question input found: ${!!input}`)
      
      expect(input).toBeInTheDocument()
    })

    it('should display the theme toggle', () => {
      render(<App />)
      
      const themeToggle = screen.getByRole('button', { name: /switch to.*mode/i })
      
      console.log(`[TEST] Theme toggle found: ${!!themeToggle}`)
      
      expect(themeToggle).toBeInTheDocument()
    })

    it('should focus the input automatically', () => {
      render(<App />)
      
      const input = screen.getByRole('textbox')
      
      console.log(`[TEST] Input has focus: ${document.activeElement === input}`)
      
      expect(input).toHaveFocus()
    })

    it('should list all accessible elements in welcome view', () => {
      render(<App />)
      
      console.log('\n=== WELCOME VIEW ACCESSIBLE ELEMENTS ===')
      logAccessibleElements()
      
      expect(screen.getAllByRole('button').length).toBeGreaterThanOrEqual(2)
    })
  })

  // ============================================
  // Question Submission Flow
  // ============================================
  describe('Question Submission Flow', () => {
    it('should transition to tree view after submitting question', async () => {
      const { user } = render(<App />)
      
      const input = screen.getByRole('textbox')
      await user.type(input, 'What is consciousness?')
      await user.keyboard('{Enter}')
      
      // Should now be in tree view
      const questionNode = await screen.findByText('What is consciousness?')
      
      console.log(`[TEST] Question node found in tree: ${!!questionNode}`)
      
      expect(questionNode).toBeInTheDocument()
    })

    it('should hide the welcome input after submission', async () => {
      const { user } = render(<App />)
      
      const input = screen.getByRole('textbox')
      await user.type(input, 'Test question')
      await user.keyboard('{Enter}')
      
      await waitFor(() => {
        // The welcome input should be gone (no placeholder "What are you curious about?")
        const welcomeInput = screen.queryByPlaceholderText(/what are you curious about/i)
        console.log(`[TEST] Welcome input hidden: ${!welcomeInput}`)
        expect(welcomeInput).not.toBeInTheDocument()
      })
    })

    it('should display smaller header in tree view', async () => {
      const { user } = render(<App />)
      
      const input = screen.getByRole('textbox')
      await user.type(input, 'Test')
      await user.keyboard('{Enter}')
      
      await waitFor(() => {
        const header = screen.getByRole('heading', { name: /fractal/i })
        console.log(`[TEST] Header in tree view: ${header.textContent}`)
        expect(header).toBeInTheDocument()
      })
    })

    it('should show "Start over" button in tree view', async () => {
      const { user } = render(<App />)
      
      const input = screen.getByRole('textbox')
      await user.type(input, 'Test')
      await user.keyboard('{Enter}')
      
      const startOverButton = await screen.findByRole('button', { name: /start over/i })
      
      console.log(`[TEST] Start over button found: ${!!startOverButton}`)
      
      expect(startOverButton).toBeInTheDocument()
    })
  })

  // ============================================
  // Tree Interaction Tests
  // ============================================
  describe('Tree Interaction', () => {
    it('should allow adding child questions', async () => {
      const { user } = render(<App />)
      
      // Submit root question
      const input = screen.getByRole('textbox')
      await user.type(input, 'Root question')
      await user.keyboard('{Enter}')
      
      // Click add child button
      const addButton = await screen.findByRole('button', { name: /customize with your own question/i })
      await user.click(addButton)
      
      // Fill in child question
      const childInput = screen.getByPlaceholderText(/what comes next/i)
      await user.type(childInput, 'Child question')
      await user.keyboard('{Enter}')
      
      // Verify child was added
      const childNode = await screen.findByText('Child question')
      
      console.log(`[TEST] Child node found: ${!!childNode}`)
      
      expect(childNode).toBeInTheDocument()
    })

    it('should allow adding multiple children', async () => {
      const { user } = render(<App />)
      
      // Submit root question
      const input = screen.getByRole('textbox')
      await user.type(input, 'Root')
      await user.keyboard('{Enter}')
      
      // Add first child
      let addButton = await screen.findByRole('button', { name: /customize with your own question/i })
      await user.click(addButton)
      let childInput = screen.getByPlaceholderText(/what comes next/i)
      await user.type(childInput, 'Child 1')
      await user.keyboard('{Enter}')
      
      // Add second child (need to find the add button for root again)
      await waitFor(async () => {
        // Get all add buttons, first one should be for root
        const addButtons = screen.getAllByRole('button', { name: /customize with your own question/i })
        await user.click(addButtons[0])
      })
      
      childInput = screen.getByPlaceholderText(/what comes next/i)
      await user.type(childInput, 'Child 2')
      await user.keyboard('{Enter}')
      
      // Verify both children exist
      const child1 = await screen.findByText('Child 1')
      const child2 = await screen.findByText('Child 2')
      
      console.log(`[TEST] Child 1 found: ${!!child1}`)
      console.log(`[TEST] Child 2 found: ${!!child2}`)
      
      expect(child1).toBeInTheDocument()
      expect(child2).toBeInTheDocument()
    })
  })

  // ============================================
  // Reset Functionality Tests
  // ============================================
  describe('Reset Functionality', () => {
    it('should return to welcome view when clicking "Start over"', async () => {
      const { user } = render(<App />)
      
      // Submit a question
      const input = screen.getByRole('textbox')
      await user.type(input, 'Test')
      await user.keyboard('{Enter}')
      
      // Click start over
      const startOverButton = await screen.findByRole('button', { name: /start over/i })
      await user.click(startOverButton)
      
      // Should be back to welcome view
      await waitFor(() => {
        const welcomeInput = screen.getByPlaceholderText(/what are you curious about/i)
        console.log(`[TEST] Welcome input visible after reset: ${!!welcomeInput}`)
        expect(welcomeInput).toBeInTheDocument()
      })
    })

    it('should clear the tree when resetting', async () => {
      const { user } = render(<App />)
      
      // Submit a question
      const input = screen.getByRole('textbox')
      await user.type(input, 'Question to be cleared')
      await user.keyboard('{Enter}')
      
      // Add a child
      const addButton = await screen.findByRole('button', { name: /customize with your own question/i })
      await user.click(addButton)
      const childInput = screen.getByPlaceholderText(/what comes next/i)
      await user.type(childInput, 'Child to be cleared')
      await user.keyboard('{Enter}')
      
      // Click start over
      const startOverButton = await screen.findByRole('button', { name: /start over/i })
      await user.click(startOverButton)
      
      // Verify tree is cleared
      await waitFor(() => {
        const oldQuestion = screen.queryByText('Question to be cleared')
        const oldChild = screen.queryByText('Child to be cleared')
        
        console.log(`[TEST] Old question cleared: ${!oldQuestion}`)
        console.log(`[TEST] Old child cleared: ${!oldChild}`)
        
        expect(oldQuestion).not.toBeInTheDocument()
        expect(oldChild).not.toBeInTheDocument()
      })
    })
  })

  // ============================================
  // Theme Toggle Tests
  // ============================================
  describe('Theme Toggle', () => {
    it('should toggle theme when clicking theme button', async () => {
      const { user } = render(<App />)
      
      const themeToggle = screen.getByRole('button', { name: /switch to.*mode/i })
      const initialLabel = themeToggle.getAttribute('aria-label')
      
      await user.click(themeToggle)
      
      const newLabel = themeToggle.getAttribute('aria-label')
      
      console.log(`[TEST] Theme toggle label: ${initialLabel} -> ${newLabel}`)
      
      expect(newLabel).not.toBe(initialLabel)
    })

    it('should persist theme toggle across interactions', async () => {
      const { user } = render(<App />)
      
      // Toggle theme
      const themeToggle = screen.getByRole('button', { name: /switch to.*mode/i })
      await user.click(themeToggle)
      
      const themeBefore = document.documentElement.getAttribute('data-theme')
      
      // Submit a question (this shouldn't affect theme)
      const input = screen.getByRole('textbox')
      await user.type(input, 'Test')
      await user.keyboard('{Enter}')
      
      const themeAfter = document.documentElement.getAttribute('data-theme')
      
      console.log(`[TEST] Theme persists: ${themeBefore} === ${themeAfter}`)
      
      expect(themeAfter).toBe(themeBefore)
    })
  })

  // ============================================
  // Complete User Journey Test
  // ============================================
  describe('Complete User Journey', () => {
    it('should support a full exploration session', async () => {
      const { user } = render(<App />)
      
      console.log('\n=== COMPLETE USER JOURNEY ===')
      
      // Step 1: Start with a root question
      console.log('[STEP 1] Submitting root question...')
      const input = screen.getByRole('textbox')
      await user.type(input, 'Why do we dream?')
      await user.keyboard('{Enter}')
      
      const rootNode = await screen.findByText('Why do we dream?')
      expect(rootNode).toBeInTheDocument()
      console.log('[STEP 1] ✓ Root question added')
      
      // Step 2: Add a child question
      console.log('[STEP 2] Adding child question...')
      const addButton1 = await screen.findByRole('button', { name: /customize with your own question/i })
      await user.click(addButton1)
      const childInput1 = screen.getByPlaceholderText(/what comes next/i)
      await user.type(childInput1, 'What happens in REM sleep?')
      await user.keyboard('{Enter}')
      
      const child1 = await screen.findByText('What happens in REM sleep?')
      expect(child1).toBeInTheDocument()
      console.log('[STEP 2] ✓ First child added')
      
      // Step 3: Add another child to root
      console.log('[STEP 3] Adding second child to root...')
      await waitFor(async () => {
        const addButtons = screen.getAllByRole('button', { name: /customize with your own question/i })
        await user.click(addButtons[0]) // First add button is for root
      })
      const childInput2 = screen.getByPlaceholderText(/what comes next/i)
      await user.type(childInput2, 'Can we control dreams?')
      await user.keyboard('{Enter}')
      
      const child2 = await screen.findByText('Can we control dreams?')
      expect(child2).toBeInTheDocument()
      console.log('[STEP 3] ✓ Second child added')
      
      // Step 4: Verify tree structure
      console.log('[STEP 4] Verifying tree structure...')
      expect(screen.getByText('Why do we dream?')).toBeInTheDocument()
      expect(screen.getByText('What happens in REM sleep?')).toBeInTheDocument()
      expect(screen.getByText('Can we control dreams?')).toBeInTheDocument()
      console.log('[STEP 4] ✓ Tree structure correct')
      
      // Step 5: Reset and start over
      console.log('[STEP 5] Resetting...')
      const startOverButton = screen.getByRole('button', { name: /start over/i })
      await user.click(startOverButton)
      
      await waitFor(() => {
        const welcomeInput = screen.getByPlaceholderText(/what are you curious about/i)
        expect(welcomeInput).toBeInTheDocument()
      })
      console.log('[STEP 5] ✓ Reset successful')
      
      console.log('=== USER JOURNEY COMPLETE ===\n')
    })
  })
})
