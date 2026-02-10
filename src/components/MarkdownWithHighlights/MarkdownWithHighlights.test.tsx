import { describe, it, expect, vi } from 'vitest'
import { createEvent, render, screen, fireEvent } from '@testing-library/react'
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

    const mark = document.querySelector('mark.concept-highlight[data-concept-name="Neural"]') as HTMLElement
    expect(mark).toBeInTheDocument()
    mark.removeAttribute('data-concept-id')
    fireEvent.click(mark)
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

    const mark = document.querySelector('mark.concept-highlight') as HTMLElement
    expect(mark).toBeInTheDocument()
    expect(mark.getAttribute('data-concept-id')).toBeNull()
    expect(mark.getAttribute('data-concept-name')).toBeNull()
    fireEvent.click(mark)
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

  it('falls back to abstract category class for unknown categories', () => {
    render(
      <MarkdownWithHighlights
        content="mystery"
        concepts={[
          concept({
            id: 'c_unknown_category',
            text: 'mystery',
            normalizedName: 'mystery',
            category: 'unknown' as unknown as ExtractedConcept['category'],
            startIndex: 0,
            endIndex: 7,
          }),
        ]}
      />
    )

    const mark = document.querySelector('mark.concept-highlight') as HTMLElement
    expect(mark.className).toContain('category-abstract')
  })

  it('handles repeated and missing concepts while inserting highlights', () => {
    render(
      <MarkdownWithHighlights
        content="AI and AI again"
        concepts={[
          concept({
            id: 'c_ai',
            text: 'AI',
            normalizedName: 'ai',
            category: 'technology',
            startIndex: 0,
            endIndex: 2,
          }),
          concept({
            id: 'c_missing',
            text: 'quantum',
            normalizedName: 'quantum',
            category: 'science',
            startIndex: 0,
            endIndex: 7,
          }),
        ]}
      />
    )

    const marks = Array.from(document.querySelectorAll('mark.concept-highlight'))
    expect(marks.length).toBe(1)
    expect(marks[0].textContent).toContain('AI')
  })

  it('covers event guard branches for non-element targets and non-mark elements', () => {
    const onConceptHover = vi.fn()
    const onConceptLeave = vi.fn()
    const onConceptClick = vi.fn()

    render(
      <MarkdownWithHighlights
        content="plain text without marks"
        concepts={[]}
        onConceptHover={onConceptHover}
        onConceptLeave={onConceptLeave}
        onConceptClick={onConceptClick}
      />
    )

    const textNode = screen.getByText('plain text without marks').firstChild as Text
    const container = screen.getByText('plain text without marks').parentElement as HTMLElement

    fireEvent.click(textNode)
    fireEvent.mouseOver(textNode)
    fireEvent.mouseOut(textNode)
    fireEvent.mouseOver(container)
    fireEvent.mouseOut(container)

    expect(onConceptClick).not.toHaveBeenCalled()
    expect(onConceptHover).not.toHaveBeenCalled()
    expect(onConceptLeave).not.toHaveBeenCalled()
  })

  it('guards click/hover/leave handlers when synthetic events target text nodes', () => {
    const onConceptHover = vi.fn()
    const onConceptLeave = vi.fn()
    const onConceptClick = vi.fn()

    render(
      <MarkdownWithHighlights
        content="plain text without marks"
        concepts={[]}
        onConceptHover={onConceptHover}
        onConceptLeave={onConceptLeave}
        onConceptClick={onConceptClick}
      />
    )

    const container = screen.getByText('plain text without marks').parentElement as HTMLElement
    const textNode = screen.getByText('plain text without marks').firstChild as Text

    const clickEvt = createEvent.click(container)
    Object.defineProperty(clickEvt, 'target', { value: textNode })
    fireEvent(container, clickEvt)

    const overEvt = createEvent.mouseOver(container)
    Object.defineProperty(overEvt, 'target', { value: textNode })
    fireEvent(container, overEvt)

    const outEvt = createEvent.mouseOut(container)
    Object.defineProperty(outEvt, 'target', { value: textNode })
    fireEvent(container, outEvt)

    expect(onConceptClick).not.toHaveBeenCalled()
    expect(onConceptHover).not.toHaveBeenCalled()
    expect(onConceptLeave).not.toHaveBeenCalled()
  })

  it('covers click/hover/leave branches when callbacks are omitted and when mark text is empty', () => {
    const onConceptClick = vi.fn()

    const { rerender } = render(
      <MarkdownWithHighlights
        content={`<mark class="concept-highlight"></mark> raw`}
        concepts={[concept({ id: 'c_empty', text: 'value', normalizedName: 'value', startIndex: 100, endIndex: 105 })]}
        onConceptClick={onConceptClick}
      />
    )

    const emptyMark = document.querySelector('mark.concept-highlight') as HTMLElement
    fireEvent.click(emptyMark)
    expect(onConceptClick).not.toHaveBeenCalled()

    rerender(
      <MarkdownWithHighlights
        content={`<mark class="concept-highlight">NEURALIZED</mark>`}
        concepts={[
          concept({
            id: 'c_norm_only',
            text: 'different-text',
            normalizedName: 'neuralized',
            startIndex: 999,
            endIndex: 1009,
          }),
        ]}
        onConceptClick={onConceptClick}
      />
    )

    const normalizedMark = document.querySelector('mark.concept-highlight') as HTMLElement
    fireEvent.click(normalizedMark)
    expect(onConceptClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'c_norm_only' }), expect.any(Object))

    rerender(
      <MarkdownWithHighlights
        content="neural network"
        concepts={[concept({ id: 'c_no_callbacks', startIndex: 0, endIndex: 14 })]}
      />
    )

    const mark = document.querySelector('mark.concept-highlight') as HTMLElement
    fireEvent.click(mark)
    fireEvent.mouseOver(mark)
    fireEvent.mouseOut(mark)
  })

  it('resolves concepts by normalized name when mark text mismatches the concept text', () => {
    const onConceptClick = vi.fn()
    const c = concept({
      id: 'c_norm_target',
      text: 'different-surface',
      normalizedName: 'normalized-target',
      startIndex: 100,
      endIndex: 120,
    })

    render(
      <MarkdownWithHighlights
        content={`Raw <mark class="concept-highlight">normalized-target</mark> concept.`}
        concepts={[c]}
        onConceptClick={onConceptClick}
      />
    )

    const mark = document.querySelector('mark.concept-highlight') as HTMLElement
    mark.removeAttribute('data-concept-id')
    mark.removeAttribute('data-concept-name')
    fireEvent.click(mark)

    expect(onConceptClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'c_norm_target' }), expect.any(Object))
  })

  it('falls back to mark text matching when concept-name metadata is present but mismatched', () => {
    const onConceptClick = vi.fn()
    const c = concept({
      id: 'c_text_fallback',
      text: 'Cognition',
      normalizedName: 'cognition',
      startIndex: 0,
      endIndex: 9,
    })

    render(
      <MarkdownWithHighlights
        content={`<mark class="concept-highlight" data-concept-name="missing">Cognition</mark>`}
        concepts={[c]}
        onConceptClick={onConceptClick}
      />
    )

    const mark = document.querySelector('mark.concept-highlight') as HTMLElement
    mark.removeAttribute('data-concept-id')
    fireEvent.click(mark)
    expect(onConceptClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'c_text_fallback' }), expect.any(Object))
  })

  it('covers remove-button guard branches for non-remove targets and missing concept ids', () => {
    const onConceptRemove = vi.fn()

    const { rerender } = render(
      <MarkdownWithHighlights
        content="neural network"
        concepts={[concept({ id: 'c_remove_guard', startIndex: 0, endIndex: 14 })]}
        onConceptRemove={onConceptRemove}
      />
    )

    const mark = document.querySelector('mark.concept-highlight') as HTMLElement
    fireEvent.click(mark)
    expect(onConceptRemove).not.toHaveBeenCalled()

    rerender(
      <MarkdownWithHighlights
        content={`<mark>orphan</mark>`}
        concepts={[]}
        onConceptRemove={onConceptRemove}
      />
    )

    const removeButtons = screen.getAllByRole('button', { name: 'Remove highlight' })
    fireEvent.click(removeButtons[0])
    expect(onConceptRemove).not.toHaveBeenCalled()
  })
})
