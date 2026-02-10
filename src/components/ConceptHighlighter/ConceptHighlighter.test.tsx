/**
 * ConceptHighlighter Component Tests
 * ===================================
 * 
 * Tests for the ConceptHighlighter component.
 * Covers text segmentation, rendering, and interaction handling.
 */

import { beforeEach, describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ConceptHighlighter, validateConcepts } from './ConceptHighlighter'
import type { ExtractedConcept } from '../../api'

const mobileState = { value: false }

vi.mock('../../hooks/useIsMobile', () => ({
  useIsMobile: () => mobileState.value,
}))

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
  beforeEach(() => {
    mobileState.value = false
  })

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

    it('falls back to abstract class for unknown categories', () => {
      const { container } = render(
        <ConceptHighlighter
          text="mystery text"
          concepts={[
            createConcept({
              id: 'c_unknown',
              category: 'unknown' as unknown as ExtractedConcept['category'],
              startIndex: 0,
              endIndex: 7,
            }),
          ]}
        />
      )

      const conceptElement = container.querySelector('[data-concept-id="c_unknown"]')
      expect(conceptElement).toBeInTheDocument()
      expect(conceptElement?.className).toContain('categoryAbstract')
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

    it('does not trigger keyboard click handler for non-activation keys', () => {
      const onClick = vi.fn()
      const concept = createConcept({ startIndex: 0, endIndex: 4 })

      render(
        <ConceptHighlighter
          text="test text"
          concepts={[concept]}
          onConceptClick={onClick}
        />
      )

      fireEvent.keyDown(screen.getByText('test'), { key: 'Escape' })
      expect(onClick).not.toHaveBeenCalled()
    })

    it('suppresses hover/leave callbacks on mobile', () => {
      mobileState.value = true
      const onHover = vi.fn()
      const onLeave = vi.fn()
      const concept = createConcept({ startIndex: 0, endIndex: 4 })

      render(
        <ConceptHighlighter
          text="test text"
          concepts={[concept]}
          onConceptHover={onHover}
          onConceptLeave={onLeave}
        />
      )

      const conceptElement = screen.getByText('test')
      fireEvent.mouseEnter(conceptElement)
      fireEvent.mouseLeave(conceptElement)
      expect(onHover).not.toHaveBeenCalled()
      expect(onLeave).not.toHaveBeenCalled()
    })

    it('should invoke onConceptRemove from remove button', () => {
      const onConceptRemove = vi.fn()
      const concept = createConcept({
        id: 'c_remove',
        normalizedName: 'remove-me',
        startIndex: 0,
        endIndex: 4,
      })

      render(
        <ConceptHighlighter
          text="test text"
          concepts={[concept]}
          onConceptRemove={onConceptRemove}
        />
      )

      fireEvent.click(screen.getByRole('button', { name: /remove highlight: remove-me/i }))
      expect(onConceptRemove).toHaveBeenCalledWith('c_remove')
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

  it('warns for invalid indices while rendering valid concepts', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const validConcept = createConcept({
      id: 'c_valid',
      text: 'good',
      normalizedName: 'good',
      startIndex: 5,
      endIndex: 9,
    })
    const invalidConcept = createConcept({
      id: 'c_invalid',
      text: 'bad',
      normalizedName: 'bad',
      startIndex: 50,
      endIndex: 60,
    })

    render(<ConceptHighlighter text="test good" concepts={[validConcept, invalidConcept]} />)
    expect(screen.getByText('good')).toBeInTheDocument()
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid concept indices'))
    warnSpy.mockRestore()
  })
})
