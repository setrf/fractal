/**
 * ConceptHighlighter Component Tests
 * ===================================
 * 
 * Tests for the ConceptHighlighter component.
 * Covers text segmentation, rendering, and interaction handling.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ConceptHighlighter, validateConcepts } from './ConceptHighlighter'
import type { ExtractedConcept } from '../../api'

// Helper to create test concepts
function createConcept(
  overrides: Partial<ExtractedConcept> = {}
): ExtractedConcept {
  return {
    id: 'c_test_123',
    text: 'test',
    normalizedName: 'test',
    category: 'abstract',
    startIndex: 0,
    endIndex: 4,
    ...overrides,
  }
}

describe('ConceptHighlighter', () => {
  describe('rendering', () => {
    it('should render plain text when no concepts provided', () => {
      render(<ConceptHighlighter text="Hello world" concepts={[]} />)
      expect(screen.getByText('Hello world')).toBeInTheDocument()
    })

    it('should render text with highlighted concepts', () => {
      const concepts: ExtractedConcept[] = [
        createConcept({
          id: 'c_1',
          text: 'dreams',
          normalizedName: 'dreams',
          category: 'psychology',
          startIndex: 10,
          endIndex: 16,
        }),
      ]

      render(
        <ConceptHighlighter
          text="Why do we dream about things?"
          concepts={concepts}
        />
      )

      // The highlighted concept should be rendered
      const conceptElement = screen.getByText('dream')
      expect(conceptElement).toBeInTheDocument()
      expect(conceptElement).toHaveAttribute('data-concept-id', 'c_1')
    })

    it('should apply correct category class', () => {
      const concepts: ExtractedConcept[] = [
        createConcept({
          category: 'science',
          startIndex: 0,
          endIndex: 4,
        }),
      ]

      const { container } = render(
        <ConceptHighlighter text="test text" concepts={concepts} />
      )

      const conceptElement = container.querySelector('[data-concept-category="science"]')
      expect(conceptElement).toBeInTheDocument()
    })

    it('should render multiple concepts in correct order', () => {
      // Text: "Why do we dream during sleep?"
      // Indices: dream = 10-15, sleep = 23-28
      const concepts: ExtractedConcept[] = [
        createConcept({
          id: 'c_1',
          text: 'dream',
          startIndex: 10,
          endIndex: 15,
        }),
        createConcept({
          id: 'c_2',
          text: 'sleep',
          startIndex: 23,
          endIndex: 28,
        }),
      ]

      render(
        <ConceptHighlighter
          text="Why do we dream during sleep?"
          concepts={concepts}
        />
      )

      expect(screen.getByText('dream')).toBeInTheDocument()
      expect(screen.getByText('sleep')).toBeInTheDocument()
    })

    it('should apply custom className', () => {
      const { container } = render(
        <ConceptHighlighter
          text="Test"
          concepts={[]}
          className="custom-class"
        />
      )

      expect(container.firstChild).toHaveClass('custom-class')
    })
  })

  describe('interactions', () => {
    it('should call onConceptHover when hovering', () => {
      const onHover = vi.fn()
      const concept = createConcept({ startIndex: 0, endIndex: 4 })

      render(
        <ConceptHighlighter
          text="test text"
          concepts={[concept]}
          onConceptHover={onHover}
        />
      )

      fireEvent.mouseEnter(screen.getByText('test'))
      expect(onHover).toHaveBeenCalledWith(concept, expect.any(Object))
    })

    it('should call onConceptLeave when leaving', () => {
      const onLeave = vi.fn()
      const concept = createConcept({ startIndex: 0, endIndex: 4 })

      render(
        <ConceptHighlighter
          text="test text"
          concepts={[concept]}
          onConceptLeave={onLeave}
        />
      )

      fireEvent.mouseLeave(screen.getByText('test'))
      expect(onLeave).toHaveBeenCalledWith(concept)
    })

    it('should call onConceptClick when clicked', () => {
      const onClick = vi.fn()
      const concept = createConcept({ startIndex: 0, endIndex: 4 })

      render(
        <ConceptHighlighter
          text="test text"
          concepts={[concept]}
          onConceptClick={onClick}
        />
      )

      fireEvent.click(screen.getByText('test'))
      expect(onClick).toHaveBeenCalledWith(concept, expect.any(Object))
    })

    it('should not call handlers when interactive=false', () => {
      const onHover = vi.fn()
      const onClick = vi.fn()
      const concept = createConcept({ startIndex: 0, endIndex: 4 })

      render(
        <ConceptHighlighter
          text="test text"
          concepts={[concept]}
          onConceptHover={onHover}
          onConceptClick={onClick}
          interactive={false}
        />
      )

      const conceptElement = screen.getByText('test')
      fireEvent.mouseEnter(conceptElement)
      fireEvent.click(conceptElement)

      expect(onHover).not.toHaveBeenCalled()
      expect(onClick).not.toHaveBeenCalled()
    })

    it('should handle keyboard events for accessibility', () => {
      const onClick = vi.fn()
      const concept = createConcept({ startIndex: 0, endIndex: 4 })

      render(
        <ConceptHighlighter
          text="test text"
          concepts={[concept]}
          onConceptClick={onClick}
        />
      )

      const conceptElement = screen.getByText('test')
      fireEvent.keyDown(conceptElement, { key: 'Enter' })
      expect(onClick).toHaveBeenCalled()
    })
  })

  describe('accessibility', () => {
    it('should have proper aria attributes when interactive', () => {
      const concept = createConcept({ startIndex: 0, endIndex: 4 })

      render(
        <ConceptHighlighter text="test text" concepts={[concept]} />
      )

      const conceptElement = screen.getByText('test')
      expect(conceptElement).toHaveAttribute('role', 'button')
      expect(conceptElement).toHaveAttribute('tabIndex', '0')
      expect(conceptElement).toHaveAttribute('aria-label')
    })

    it('should not have button role when not interactive', () => {
      const concept = createConcept({ startIndex: 0, endIndex: 4 })

      render(
        <ConceptHighlighter
          text="test text"
          concepts={[concept]}
          interactive={false}
        />
      )

      const conceptElement = screen.getByText('test')
      expect(conceptElement).not.toHaveAttribute('role')
    })
  })
})

describe('validateConcepts', () => {
  it('should return true for empty concepts', () => {
    expect(validateConcepts('test', [])).toBe(true)
  })

  it('should return true for valid non-overlapping concepts', () => {
    const concepts: ExtractedConcept[] = [
      createConcept({ startIndex: 0, endIndex: 4 }),
      createConcept({ startIndex: 5, endIndex: 10 }),
    ]
    expect(validateConcepts('test hello', concepts)).toBe(true)
  })

  it('should return false for overlapping concepts', () => {
    const concepts: ExtractedConcept[] = [
      createConcept({ startIndex: 0, endIndex: 5 }),
      createConcept({ startIndex: 3, endIndex: 8 }),
    ]
    expect(validateConcepts('test hello', concepts)).toBe(false)
  })

  it('should return false for out-of-bounds concepts', () => {
    const concepts: ExtractedConcept[] = [
      createConcept({ startIndex: 0, endIndex: 100 }),
    ]
    expect(validateConcepts('test', concepts)).toBe(false)
  })

  it('should return false for negative indices', () => {
    const concepts: ExtractedConcept[] = [
      createConcept({ startIndex: -1, endIndex: 4 }),
    ]
    expect(validateConcepts('test', concepts)).toBe(false)
  })
})
