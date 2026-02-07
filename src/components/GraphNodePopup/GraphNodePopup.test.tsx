import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { GraphNodePopup } from './GraphNodePopup'
import type { GraphNode } from '../../types/graph'
import { createQuestionNode } from '../../types/question'
import type { ExtractedConcept } from '../../types/concept'
import type { StashItem } from '../../types/stash'
import type { Probe } from '../../types/probe'

function setWindowSize(width: number, height: number): void {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  })
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    writable: true,
    value: height,
  })
}

describe('GraphNodePopup', () => {
  it('renders question details and fires Deep dive / Chat callbacks', () => {
    setWindowSize(1280, 900)
    const question = createQuestionNode('What is consciousness?')
    question.childIds = ['q_child_1', 'q_child_2']
    question.meta.qualityScore = 8.25

    const node: GraphNode = {
      id: question.id,
      type: 'question',
      label: question.text,
      data: question,
      color: '#4488dd',
      size: 1,
      group: question.id,
    }

    const onDeepDive = vi.fn()
    const onChat = vi.fn()

    render(
      <GraphNodePopup
        node={node}
        position={{ x: 100, y: 120 }}
        onClose={() => {}}
        onDeepDive={onDeepDive}
        onChat={onChat}
      />
    )

    expect(screen.getByText('What is consciousness?')).toBeInTheDocument()
    expect(screen.getByText('2 sub-questions')).toBeInTheDocument()
    expect(screen.getByText('Quality 8.25 / 10')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Deep dive' }))
    fireEvent.click(screen.getByRole('button', { name: 'Chat' }))

    expect(onDeepDive).toHaveBeenCalledWith(question.id, question.text)
    expect(onChat).toHaveBeenCalledWith(question.id, question.text)
  })

  it('renders concept details and fires stash callback', () => {
    setWindowSize(1280, 900)
    const concept: ExtractedConcept = {
      id: 'c_1',
      text: 'consciousness',
      normalizedName: 'Consciousness',
      category: 'science',
      startIndex: 0,
      endIndex: 12,
    }
    const node: GraphNode = {
      id: 'c_1',
      type: 'concept',
      label: concept.normalizedName,
      data: concept,
      color: '#aa66cc',
      size: 0.5,
      group: 'q_1',
    }

    const onStash = vi.fn()
    render(
      <GraphNodePopup
        node={node}
        position={{ x: 90, y: 90 }}
        onClose={() => {}}
        onStash={onStash}
      />
    )

    expect(screen.getByText('Science')).toBeInTheDocument()
    expect(screen.getByText('Consciousness')).toBeInTheDocument()
    expect(screen.getByText('"consciousness"')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Add to Stash' }))
    expect(onStash).toHaveBeenCalledWith(node)
  })

  it('renders stash item preview with truncation and title metadata', () => {
    setWindowSize(1280, 900)
    const stash: StashItem = {
      id: 's_1',
      type: 'note',
      content: 'A'.repeat(180),
      metadata: { title: 'Field Note' },
      createdAt: Date.now(),
    }
    const node: GraphNode = {
      id: stash.id,
      type: 'stash',
      label: 'A saved note',
      data: stash,
      color: '#44aa88',
      size: 0.4,
      group: 'q_1',
    }

    render(<GraphNodePopup node={node} position={{ x: 50, y: 60 }} onClose={() => {}} />)

    expect(screen.getByText(/Title: Field Note/)).toBeInTheDocument()
    expect(screen.getByText(/\.{3}$/)).toBeInTheDocument()
  })

  it('renders probe details with message and selected item counts', () => {
    setWindowSize(1280, 900)
    const probe: Probe = {
      id: 'p_1',
      name: 'Probe Alpha',
      color: 'green',
      messages: [
        { id: 'pm_1', role: 'user', content: 'hello', timestamp: Date.now() - 10 },
        { id: 'pm_2', role: 'assistant', content: 'hi', timestamp: Date.now() },
      ],
      selectedStashItemIds: ['s_1', 's_2', 's_3'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    const node: GraphNode = {
      id: probe.id,
      type: 'probe',
      label: probe.name,
      data: probe,
      color: '#dd8844',
      size: 0.7,
      group: 'probe',
    }

    render(<GraphNodePopup node={node} position={{ x: 10, y: 10 }} onClose={() => {}} />)

    expect(screen.getByText('Probe Alpha')).toBeInTheDocument()
    expect(screen.getByText('2 messages')).toBeInTheDocument()
    expect(screen.getByText('3 items selected')).toBeInTheDocument()
  })

  it('falls back to generic rendering when node data does not match expected shape', () => {
    setWindowSize(1280, 900)
    const node: GraphNode = {
      id: 'q_invalid',
      type: 'question',
      label: 'Fallback Label',
      data: {} as unknown as GraphNode['data'],
      color: '#000',
      size: 1,
      group: 'g',
    }

    render(<GraphNodePopup node={node} position={{ x: 0, y: 0 }} onClose={() => {}} />)

    expect(screen.getByText('question')).toBeInTheDocument()
    expect(screen.getByText('Fallback Label')).toBeInTheDocument()
  })

  it('fires onClose when close button is clicked', () => {
    setWindowSize(1280, 900)
    const question = createQuestionNode('Close me')
    const node: GraphNode = {
      id: question.id,
      type: 'question',
      label: question.text,
      data: question,
      color: '#4488dd',
      size: 1,
      group: question.id,
    }
    const onClose = vi.fn()

    render(<GraphNodePopup node={node} position={{ x: 10, y: 10 }} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'Close popup' }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('clamps popup position inside desktop viewport', () => {
    setWindowSize(1000, 800)
    const question = createQuestionNode('Clamp')
    const node: GraphNode = {
      id: question.id,
      type: 'question',
      label: question.text,
      data: question,
      color: '#4488dd',
      size: 1,
      group: question.id,
    }

    render(<GraphNodePopup node={node} position={{ x: 950, y: 750 }} onClose={() => {}} />)
    const popup = screen.getByRole('button', { name: 'Close popup' }).parentElement as HTMLElement

    expect(popup.style.left).toBe('680px')
    expect(popup.style.top).toBe('500px')
  })

  it('uses default positioning style on mobile', () => {
    setWindowSize(640, 900)
    const question = createQuestionNode('Mobile')
    const node: GraphNode = {
      id: question.id,
      type: 'question',
      label: question.text,
      data: question,
      color: '#4488dd',
      size: 1,
      group: question.id,
    }

    render(<GraphNodePopup node={node} position={{ x: 500, y: 700 }} onClose={() => {}} />)
    const popup = screen.getByRole('button', { name: 'Close popup' }).parentElement as HTMLElement

    expect(popup.style.left).toBe('')
    expect(popup.style.top).toBe('')
  })
})
