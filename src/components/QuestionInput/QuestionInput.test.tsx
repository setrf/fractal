/**
 * QuestionInput Component Tests
 * =============================
 * 
 * Tests for the central question input component.
 * 
 * Test Coverage:
 * - Rendering with default props
 * - Rendering with custom props
 * - User input handling
 * - Submit button behavior
 * - Keyboard interaction (Enter key)
 * - Placeholder text
 * - Auto-focus behavior
 * - Empty input handling
 * 
 * These tests verify the user-facing behavior of the input component.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, logAccessibleElements } from '../../test/test-utils'
import { QuestionInput } from './QuestionInput'

describe('QuestionInput Component', () => {
  
  // Default mock for onSubmit
  let mockOnSubmit: ReturnType<typeof vi.fn>
  
  beforeEach(() => {
    mockOnSubmit = vi.fn()
  })

  // ============================================
  // Rendering Tests
  // ============================================
  describe('Rendering', () => {
    it('should render the input field', () => {
      render(<QuestionInput onSubmit={mockOnSubmit} />)
      
      const input = screen.getByRole('textbox', { name: /enter your question/i })
      
      console.log(`[TEST] Input found: ${!!input}`)
      console.log(`[TEST] Input tag: ${input.tagName.toLowerCase()}`)
      
      expect(input).toBeInTheDocument()
      // Using textarea for dynamic resizing
      expect(input.tagName.toLowerCase()).toBe('textarea')
    })

    it('should render the submit button', () => {
      render(<QuestionInput onSubmit={mockOnSubmit} />)
      
      const button = screen.getByRole('button', { name: /submit question/i })
      
      console.log(`[TEST] Submit button found: ${!!button}`)
      console.log(`[TEST] Button text: ${button.textContent}`)
      
      expect(button).toBeInTheDocument()
      expect(button).toHaveTextContent('→')
    })

    it('should render the question prompt', () => {
      render(<QuestionInput onSubmit={mockOnSubmit} />)
      
      const prompt = screen.getByText('?')
      
      console.log(`[TEST] Prompt found: ${!!prompt}`)
      
      expect(prompt).toBeInTheDocument()
    })

    it('should render the hint text', () => {
      render(<QuestionInput onSubmit={mockOnSubmit} />)
      
      const hint = screen.getByText(/press enter to explore/i)
      
      console.log(`[TEST] Hint found: ${!!hint}`)
      
      expect(hint).toBeInTheDocument()
    })

    it('should render with default placeholder', () => {
      render(<QuestionInput onSubmit={mockOnSubmit} />)
      
      const input = screen.getByPlaceholderText(/what are you curious about/i)
      
      console.log(`[TEST] Default placeholder found: ${!!input}`)
      
      expect(input).toBeInTheDocument()
    })

    it('should render with custom placeholder', () => {
      const customPlaceholder = 'Ask anything...'
      render(<QuestionInput onSubmit={mockOnSubmit} placeholder={customPlaceholder} />)
      
      const input = screen.getByPlaceholderText(customPlaceholder)
      
      console.log(`[TEST] Custom placeholder: ${input.getAttribute('placeholder')}`)
      
      expect(input).toBeInTheDocument()
    })

    it('should list all accessible elements', () => {
      render(<QuestionInput onSubmit={mockOnSubmit} />)
      
      logAccessibleElements()
      
      // Verify core accessible elements exist
      expect(screen.getByRole('textbox')).toBeInTheDocument()
      expect(screen.getByRole('button')).toBeInTheDocument()
    })
  })

  // ============================================
  // Submit Button State Tests
  // ============================================
  describe('Submit Button State', () => {
    it('should disable submit button when input is empty', () => {
      render(<QuestionInput onSubmit={mockOnSubmit} />)
      
      const button = screen.getByRole('button', { name: /submit/i })
      
      console.log(`[TEST] Button disabled when empty: ${button.hasAttribute('disabled')}`)
      
      expect(button).toBeDisabled()
    })

    it('should disable submit button when input is only whitespace', async () => {
      const { user } = render(<QuestionInput onSubmit={mockOnSubmit} />)
      
      const input = screen.getByRole('textbox')
      await user.type(input, '   ')
      
      const button = screen.getByRole('button', { name: /submit/i })
      
      console.log(`[TEST] Input value: "${input.getAttribute('value')}"`)
      console.log(`[TEST] Button disabled with whitespace: ${button.hasAttribute('disabled')}`)
      
      expect(button).toBeDisabled()
    })

    it('should enable submit button when input has text', async () => {
      const { user } = render(<QuestionInput onSubmit={mockOnSubmit} />)
      
      const input = screen.getByRole('textbox')
      await user.type(input, 'Hello')
      
      const button = screen.getByRole('button', { name: /submit/i })
      
      console.log(`[TEST] Button enabled with text: ${!button.hasAttribute('disabled')}`)
      
      expect(button).not.toBeDisabled()
    })
  })

  // ============================================
  // User Interaction Tests
  // ============================================
  describe('User Interaction', () => {
    it('should update input value when typing', async () => {
      const { user } = render(<QuestionInput onSubmit={mockOnSubmit} />)
      
      const input = screen.getByRole('textbox')
      const testText = 'What is the meaning of life?'
      
      await user.type(input, testText)
      
      console.log(`[TEST] Input value after typing: ${(input as HTMLInputElement).value}`)
      
      expect(input).toHaveValue(testText)
    })

    it('should call onSubmit when clicking submit button', async () => {
      const { user } = render(<QuestionInput onSubmit={mockOnSubmit} />)
      
      const input = screen.getByRole('textbox')
      const button = screen.getByRole('button', { name: /submit/i })
      
      await user.type(input, 'Test question')
      await user.click(button)
      
      console.log(`[TEST] onSubmit called: ${mockOnSubmit.mock.calls.length} time(s)`)
      console.log(`[TEST] onSubmit argument: "${mockOnSubmit.mock.calls[0]?.[0]}"`)
      
      expect(mockOnSubmit).toHaveBeenCalledTimes(1)
      expect(mockOnSubmit).toHaveBeenCalledWith('Test question')
    })

    it('should call onSubmit when pressing Enter', async () => {
      const { user } = render(<QuestionInput onSubmit={mockOnSubmit} />)
      
      const input = screen.getByRole('textbox')
      
      await user.type(input, 'Another question')
      await user.keyboard('{Enter}')
      
      console.log(`[TEST] onSubmit called via Enter: ${mockOnSubmit.mock.calls.length} time(s)`)
      
      expect(mockOnSubmit).toHaveBeenCalledTimes(1)
      expect(mockOnSubmit).toHaveBeenCalledWith('Another question')
    })

    it('should clear input after submit', async () => {
      const { user } = render(<QuestionInput onSubmit={mockOnSubmit} />)
      
      const input = screen.getByRole('textbox')
      
      await user.type(input, 'Will be cleared')
      await user.keyboard('{Enter}')
      
      console.log(`[TEST] Input value after submit: "${(input as HTMLInputElement).value}"`)
      
      expect(input).toHaveValue('')
    })

    it('should trim whitespace from submitted text', async () => {
      const { user } = render(<QuestionInput onSubmit={mockOnSubmit} />)
      
      const input = screen.getByRole('textbox')
      
      await user.type(input, '  padded text  ')
      await user.keyboard('{Enter}')
      
      console.log(`[TEST] Submitted value (trimmed): "${mockOnSubmit.mock.calls[0]?.[0]}"`)
      
      expect(mockOnSubmit).toHaveBeenCalledWith('padded text')
    })

    it('should not submit empty input on Enter', async () => {
      const { user } = render(<QuestionInput onSubmit={mockOnSubmit} />)
      
      const input = screen.getByRole('textbox')
      input.focus()
      
      await user.keyboard('{Enter}')
      
      console.log(`[TEST] onSubmit not called for empty: ${mockOnSubmit.mock.calls.length === 0}`)
      
      expect(mockOnSubmit).not.toHaveBeenCalled()
    })

    it('should not submit whitespace-only input', async () => {
      const { user } = render(<QuestionInput onSubmit={mockOnSubmit} />)
      
      const input = screen.getByRole('textbox')
      
      await user.type(input, '    ')
      await user.keyboard('{Enter}')
      
      console.log(`[TEST] onSubmit not called for whitespace: ${mockOnSubmit.mock.calls.length === 0}`)
      
      expect(mockOnSubmit).not.toHaveBeenCalled()
    })
  })

  // ============================================
  // Auto-Focus Tests
  // ============================================
  describe('Auto-Focus', () => {
    it('should auto-focus input by default', () => {
      render(<QuestionInput onSubmit={mockOnSubmit} />)
      
      const input = screen.getByRole('textbox')
      
      console.log(`[TEST] Input has focus: ${document.activeElement === input}`)
      
      expect(input).toHaveFocus()
    })

    it('should not auto-focus when autoFocus is false', () => {
      render(<QuestionInput onSubmit={mockOnSubmit} autoFocus={false} />)
      
      const input = screen.getByRole('textbox')
      
      console.log(`[TEST] Input focused when autoFocus=false: ${document.activeElement === input}`)
      
      expect(input).not.toHaveFocus()
    })

    it('should auto-resize when viewport is under the mobile breakpoint', async () => {
      const originalWidth = window.innerWidth
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        value: 360,
      })

      const { container, user } = render(<QuestionInput onSubmit={mockOnSubmit} />)
      const input = screen.getByRole('textbox')
      await user.type(input, 'Mobile width branch')

      const wrapper = container.querySelector('[data-onboarding="question-input"]') as HTMLElement
      expect(parseInt(wrapper.style.width, 10)).toBeGreaterThan(0)

      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        value: originalWidth,
      })
    })
  })

  // ============================================
  // Accessibility Tests
  // ============================================
  describe('Accessibility', () => {
    it('should have accessible name for input', () => {
      render(<QuestionInput onSubmit={mockOnSubmit} />)
      
      const input = screen.getByLabelText(/enter your question/i)
      
      console.log(`[TEST] Input has accessible label: ${!!input}`)
      
      expect(input).toBeInTheDocument()
    })

    it('should have accessible name for submit button', () => {
      render(<QuestionInput onSubmit={mockOnSubmit} />)
      
      const button = screen.getByRole('button', { name: /submit question/i })
      
      console.log(`[TEST] Button has accessible name: ${button.getAttribute('aria-label')}`)
      
      expect(button).toHaveAttribute('aria-label', 'Submit question')
    })
  })
})
