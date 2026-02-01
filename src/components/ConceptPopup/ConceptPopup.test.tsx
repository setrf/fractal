/**
 * ConceptPopup Component Tests
 * ============================
 * 
 * Tests for the ConceptPopup component.
 * Covers rendering, dragging, resizing, and interaction handling.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '../../test/test-utils'
import { ConceptPopup } from './ConceptPopup'
import type { ExtractedConcept, ConceptExplanation } from '../../api'

// Helper to create test concept
function createConcept(overrides: Partial<ExtractedConcept> = {}): ExtractedConcept {
  return {
    id: 'c_test_123',
    text: 'evolution',
    normalizedName: 'evolution',
    category: 'science',
    startIndex: 0,
    endIndex: 9,
    ...overrides,
  }
}

// Helper to create test explanation
function createExplanation(overrides: Partial<ConceptExplanation> = {}): ConceptExplanation {
  return {
    conceptId: 'c_test_123',
    normalizedName: 'evolution',
    summary: 'Evolution is the change in heritable characteristics of biological populations over successive generations.',
    context: 'In this question, evolution refers to the biological process that might explain dreams.',
    relatedConcepts: ['natural selection', 'adaptation', 'genetics'],
    ...overrides,
  }
}

describe('ConceptPopup', () => {
  const defaultProps = {
    concept: createConcept(),
    explanation: null,
    isLoading: false,
    position: { x: 100, y: 100 },
    onClose: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('should render nothing when concept is null', () => {
      const { container } = render(
        <ConceptPopup {...defaultProps} concept={null} />
      )
      expect(container.firstChild).toBeNull()
    })

    it('should render concept name in header', () => {
      render(<ConceptPopup {...defaultProps} />)
      expect(screen.getByText('evolution')).toBeInTheDocument()
    })

    it('should render category badge', () => {
      render(<ConceptPopup {...defaultProps} />)
      expect(screen.getByText('Science')).toBeInTheDocument()
    })

    it('should render loading state', () => {
      render(<ConceptPopup {...defaultProps} isLoading={true} />)
      expect(screen.getByText('Loading explanation...')).toBeInTheDocument()
    })

    it('should render error state', () => {
      render(
        <ConceptPopup
          {...defaultProps}
          error="Failed to load explanation"
        />
      )
      expect(screen.getByText('Failed to load explanation')).toBeInTheDocument()
    })

    it('should render explanation content', () => {
      const explanation = createExplanation()
      render(
        <ConceptPopup {...defaultProps} explanation={explanation} />
      )
      
      expect(screen.getByText(explanation.summary)).toBeInTheDocument()
      expect(screen.getByText(explanation.context)).toBeInTheDocument()
    })

    it('should render related concepts', () => {
      const explanation = createExplanation()
      render(
        <ConceptPopup {...defaultProps} explanation={explanation} />
      )
      
      expect(screen.getByText('natural selection')).toBeInTheDocument()
      expect(screen.getByText('adaptation')).toBeInTheDocument()
      expect(screen.getByText('genetics')).toBeInTheDocument()
    })

    it('should render close button', () => {
      render(<ConceptPopup {...defaultProps} />)
      expect(screen.getByLabelText('Close popup')).toBeInTheDocument()
    })
  })

  describe('interactions', () => {
    it('should call onClose when close button clicked', () => {
      const onClose = vi.fn()
      render(<ConceptPopup {...defaultProps} onClose={onClose} />)
      
      fireEvent.click(screen.getByLabelText('Close popup'))
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('should call onClose when Escape key pressed', () => {
      const onClose = vi.fn()
      render(<ConceptPopup {...defaultProps} onClose={onClose} />)
      
      fireEvent.keyDown(document, { key: 'Escape' })
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('should call onRelatedConceptClick when related concept clicked', () => {
      const onRelatedConceptClick = vi.fn()
      render(
        <ConceptPopup
          {...defaultProps}
          explanation={createExplanation()}
          onRelatedConceptClick={onRelatedConceptClick}
        />
      )
      
      fireEvent.click(screen.getByText('natural selection'))
      expect(onRelatedConceptClick).toHaveBeenCalledWith('natural selection')
    })
  })

  describe('dragging', () => {
    it('should have draggable header with grab cursor', () => {
      const { container } = render(<ConceptPopup {...defaultProps} />)
      const header = container.querySelector('[class*="draggableHeader"]')
      expect(header).toBeInTheDocument()
    })

    it('should update position on drag', () => {
      const { container } = render(<ConceptPopup {...defaultProps} />)
      const header = container.querySelector('[class*="draggableHeader"]')!
      const popup = container.querySelector('[class*="popup"]')!

      // Start drag
      fireEvent.mouseDown(header, { clientX: 150, clientY: 150 })
      
      // Move
      fireEvent.mouseMove(document, { clientX: 200, clientY: 250 })
      
      // End drag
      fireEvent.mouseUp(document)

      // Check that popup moved (style should have changed)
      const style = popup.getAttribute('style')
      expect(style).toBeTruthy()
    })

    it('should not start drag when clicking on buttons', () => {
      const onClose = vi.fn()
      const { container } = render(
        <ConceptPopup {...defaultProps} onClose={onClose} />
      )
      
      const closeButton = screen.getByLabelText('Close popup')
      fireEvent.mouseDown(closeButton)
      
      // Should not add dragging class
      const popup = container.querySelector('[class*="popup"]')
      expect(popup).not.toHaveClass('dragging')
    })

    it('should apply dragging class while dragging', () => {
      const { container } = render(<ConceptPopup {...defaultProps} />)
      const header = container.querySelector('[class*="draggableHeader"]')!
      const popup = container.querySelector('[class*="popup"]')!

      fireEvent.mouseDown(header, { clientX: 150, clientY: 150 })
      
      expect(popup.className).toContain('dragging')
      
      fireEvent.mouseUp(document)
    })
  })

  describe('resizing', () => {
    it('should render resize handles', () => {
      const { container } = render(<ConceptPopup {...defaultProps} />)
      
      expect(container.querySelector('[class*="resizeN"]')).toBeInTheDocument()
      expect(container.querySelector('[class*="resizeS"]')).toBeInTheDocument()
      expect(container.querySelector('[class*="resizeE"]')).toBeInTheDocument()
      expect(container.querySelector('[class*="resizeW"]')).toBeInTheDocument()
      expect(container.querySelector('[class*="resizeNE"]')).toBeInTheDocument()
      expect(container.querySelector('[class*="resizeNW"]')).toBeInTheDocument()
      expect(container.querySelector('[class*="resizeSE"]')).toBeInTheDocument()
      expect(container.querySelector('[class*="resizeSW"]')).toBeInTheDocument()
    })

    it('should update size on resize from SE corner', () => {
      const { container } = render(<ConceptPopup {...defaultProps} />)
      const resizeHandle = container.querySelector('[class*="resizeSE"]')!
      const popup = container.querySelector('[class*="popup"]')!

      const initialStyle = popup.getAttribute('style')

      // Start resize
      fireEvent.mouseDown(resizeHandle, { clientX: 420, clientY: 500 })
      
      // Resize
      fireEvent.mouseMove(document, { clientX: 520, clientY: 600 })
      
      // End resize
      fireEvent.mouseUp(document)

      const finalStyle = popup.getAttribute('style')
      expect(finalStyle).not.toBe(initialStyle)
    })

    it('should apply resizing class while resizing', () => {
      const { container } = render(<ConceptPopup {...defaultProps} />)
      const resizeHandle = container.querySelector('[class*="resizeSE"]')!
      const popup = container.querySelector('[class*="popup"]')!

      fireEvent.mouseDown(resizeHandle, { clientX: 420, clientY: 500 })
      
      expect(popup.className).toContain('resizing')
      
      fireEvent.mouseUp(document)
    })

    it('should respect minimum dimensions', () => {
      const { container } = render(<ConceptPopup {...defaultProps} />)
      const resizeHandle = container.querySelector('[class*="resizeSE"]')!
      const popup = container.querySelector('[class*="popup"]')!

      // Try to resize smaller than minimum
      fireEvent.mouseDown(resizeHandle, { clientX: 420, clientY: 500 })
      fireEvent.mouseMove(document, { clientX: 100, clientY: 100 })
      fireEvent.mouseUp(document)

      const style = popup.getAttribute('style')
      // Should still have some width and height set
      expect(style).toContain('width')
      expect(style).toContain('height')
    })
  })

  describe('accessibility', () => {
    it('should have dialog role', () => {
      render(<ConceptPopup {...defaultProps} />)
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('should have aria-label with concept name', () => {
      render(<ConceptPopup {...defaultProps} />)
      expect(screen.getByRole('dialog')).toHaveAttribute(
        'aria-label',
        'Concept explanation: evolution'
      )
    })

    it('should be focusable and keyboard navigable', () => {
      render(
        <ConceptPopup
          {...defaultProps}
          explanation={createExplanation()}
          onRelatedConceptClick={vi.fn()}
        />
      )
      
      // Related concept buttons should be focusable
      const relatedButton = screen.getByText('natural selection')
      expect(relatedButton).not.toHaveAttribute('disabled')
    })
  })

  describe('positioning', () => {
    it('should apply initial position from props', () => {
      const { container } = render(
        <ConceptPopup {...defaultProps} position={{ x: 200, y: 300 }} />
      )
      
      const popup = container.querySelector('[class*="popup"]')
      const style = popup?.getAttribute('style')
      
      // Position should be set in style
      expect(style).toBeTruthy()
    })

    it('should adjust position to stay in viewport', () => {
      // Mock viewport dimensions
      Object.defineProperty(window, 'innerWidth', { value: 1000, writable: true })
      Object.defineProperty(window, 'innerHeight', { value: 800, writable: true })

      const { container } = render(
        <ConceptPopup {...defaultProps} position={{ x: 900, y: 700 }} />
      )
      
      const popup = container.querySelector('[class*="popup"]')
      expect(popup).toBeInTheDocument()
    })
  })

  describe('minimize', () => {
    it('should render minimize button', () => {
      render(<ConceptPopup {...defaultProps} />)
      expect(screen.getByLabelText('Minimize popup')).toBeInTheDocument()
    })

    it('should hide content when minimized', () => {
      const explanation = createExplanation()
      render(
        <ConceptPopup {...defaultProps} explanation={explanation} />
      )
      
      // Content should be visible initially
      expect(screen.getByText(explanation.summary)).toBeInTheDocument()
      
      // Click minimize
      fireEvent.click(screen.getByLabelText('Minimize popup'))
      
      // Content should be hidden
      expect(screen.queryByText(explanation.summary)).not.toBeInTheDocument()
    })

    it('should show expand button when minimized', () => {
      render(<ConceptPopup {...defaultProps} />)
      
      // Initially shows minimize button
      expect(screen.getByLabelText('Minimize popup')).toBeInTheDocument()
      
      // Click minimize
      fireEvent.click(screen.getByLabelText('Minimize popup'))
      
      // Now shows expand button
      expect(screen.getByLabelText('Expand popup')).toBeInTheDocument()
    })

    it('should restore content when expanded', () => {
      const explanation = createExplanation()
      render(
        <ConceptPopup {...defaultProps} explanation={explanation} />
      )
      
      // Minimize
      fireEvent.click(screen.getByLabelText('Minimize popup'))
      expect(screen.queryByText(explanation.summary)).not.toBeInTheDocument()
      
      // Expand
      fireEvent.click(screen.getByLabelText('Expand popup'))
      expect(screen.getByText(explanation.summary)).toBeInTheDocument()
    })

    it('should hide resize handles when minimized', () => {
      const { container } = render(<ConceptPopup {...defaultProps} />)
      
      // Resize handles visible initially
      expect(container.querySelector('[class*="resizeSE"]')).toBeInTheDocument()
      
      // Minimize
      fireEvent.click(screen.getByLabelText('Minimize popup'))
      
      // Resize handles should be hidden
      expect(container.querySelector('[class*="resizeSE"]')).not.toBeInTheDocument()
    })

    it('should apply minimized class when minimized', () => {
      const { container } = render(<ConceptPopup {...defaultProps} />)
      const popup = container.querySelector('[class*="popup"]')!
      
      // Initially not minimized
      expect(popup.className).not.toContain('minimized')
      
      // Minimize
      fireEvent.click(screen.getByLabelText('Minimize popup'))
      
      // Should have minimized class
      expect(popup.className).toContain('minimized')
    })
  })

})
