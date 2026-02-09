import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MarkdownWithHighlights } from './MarkdownWithHighlights'
import type { ExtractedConcept } from '../../api'

const concept = (overrides: Partial<ExtractedConcept> = {}): ExtractedConcept => ({
  id: 'c_1',
  text: 'neural network',
  normalizedName: 'neural network',
  category: 'technology',
  startIndex: 0,
  endIndex: 14,
  ...overrides,
})

describe('MarkdownWithHighlights', () => {
  it('renders markdown and inserts interactive concept highlights', () => {
    render(
      <MarkdownWithHighlights
        content="We can discuss **neural network** behavior."
        concepts={[concept({ startIndex: 16, endIndex: 30 })]}
      />
    )

    const mark = document.querySelector('mark.concept-highlight') as HTMLElement
    expect(mark).toBeInTheDocument()
    expect(mark).toHaveAttribute('data-concept-id', 'c_1')
    expect(mark.textContent).toContain('neural network')
  })

  it('prefers longer overlapping phrases first', () => {
    render(
      <MarkdownWithHighlights
        content="AI safety starts with AI alignment."
        concepts={[
          concept({
            id: 'c_short',
            text: 'AI',
            normalizedName: 'ai',
            category: 'technology',
            startIndex: 0,
            endIndex: 2,
          }),
          concept({
            id: 'c_long',
            text: 'AI safety',
            normalizedName: 'ai safety',
            category: 'technology',
            startIndex: 0,
            endIndex: 9,
          }),
        ]}
      />
    )

    const marks = Array.from(document.querySelectorAll('mark.concept-highlight'))
    expect(marks.some(mark => mark.getAttribute('data-concept-id') === 'c_long')).toBe(true)
  })

  it('fires hover/leave/click handlers for highlighted concepts', () => {
    const onConceptHover = vi.fn()
    const onConceptLeave = vi.fn()
    const onConceptClick = vi.fn()
    const c = concept({ id: 'c_interact', startIndex: 0, endIndex: 14 })

    render(
      <MarkdownWithHighlights
        content="neural network"
        concepts={[c]}
        onConceptHover={onConceptHover}
        onConceptLeave={onConceptLeave}
        onConceptClick={onConceptClick}
      />
    )

    const mark = document.querySelector('mark.concept-highlight') as HTMLElement
    fireEvent.mouseOver(mark)
    fireEvent.mouseOut(mark)
    fireEvent.click(mark)

    expect(onConceptHover).toHaveBeenCalledWith(c, expect.any(Object))
    expect(onConceptLeave).toHaveBeenCalledWith(c)
    expect(onConceptClick).toHaveBeenCalledWith(c, expect.any(Object))
  })

  it('supports concept removal callbacks via inline remove buttons', () => {
    const onConceptRemove = vi.fn()
    render(
      <MarkdownWithHighlights
        content="neural network"
        concepts={[concept({ id: 'c_remove', startIndex: 0, endIndex: 14 })]}
        onConceptRemove={onConceptRemove}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Remove highlight' }))
    expect(onConceptRemove).toHaveBeenCalledWith('c_remove')
  })

  it('does not render remove buttons when onConceptRemove is not provided', () => {
    render(
      <MarkdownWithHighlights
        content="neural network"
        concepts={[concept({ id: 'c_no_remove', startIndex: 0, endIndex: 14 })]}
      />
    )

    expect(screen.queryByRole('button', { name: 'Remove highlight' })).not.toBeInTheDocument()
  })

  it('resolves clicked concept by data-concept-name fallback', () => {
    const onConceptClick = vi.fn()
    const c = concept({ id: 'c_name', text: 'Neural', normalizedName: 'Neural', startIndex: 200, endIndex: 206 })

    render(
      <MarkdownWithHighlights
        content={`Raw <mark class="concept-highlight" data-concept-name="Neural">Neural</mark> concept.`}
        concepts={[c]}
        onConceptClick={onConceptClick}
      />
    )

    fireEvent.click(screen.getByText('Neural'))
    expect(onConceptClick).toHaveBeenCalledWith(c, expect.any(Object))
  })

  it('resolves clicked concept by text fallback when mark metadata is missing', () => {
    const onConceptClick = vi.fn()
    const c = concept({ id: 'c_text', text: 'Cognition', normalizedName: 'cognition', startIndex: 999, endIndex: 1008 })

    render(
      <MarkdownWithHighlights
        content={`Raw <mark class="concept-highlight">Cognition ×</mark> concept.`}
        concepts={[c]}
        onConceptClick={onConceptClick}
      />
    )

    fireEvent.click(screen.getByText(/Cognition/))
    expect(onConceptClick).toHaveBeenCalledWith(c, expect.any(Object))
  })

  it('escapes HTML-sensitive concept text and attributes', () => {
    render(
      <MarkdownWithHighlights
        content={`Escaped <dangerous> marker`}
        concepts={[
          concept({
            id: `c_"unsafe"`,
            text: '<dangerous>',
            normalizedName: `danger"attr`,
            startIndex: 8,
            endIndex: 19,
            category: 'abstract',
          }),
        ]}
      />
    )

    const mark = document.querySelector('mark.concept-highlight') as HTMLElement
    expect(mark).toBeInTheDocument()
    expect(mark.textContent).toBe('<dangerous>')
  })

  it('applies custom className and ignores non-highlight clicks', () => {
    const onConceptClick = vi.fn()
    render(
      <MarkdownWithHighlights
        content="plain text"
        concepts={[]}
        onConceptClick={onConceptClick}
        className="custom-md"
      />
    )

    const container = document.querySelector('.custom-md') as HTMLElement
    expect(container).toBeInTheDocument()

    fireEvent.click(screen.getByText('plain text'))
    expect(onConceptClick).not.toHaveBeenCalled()
  })
})
