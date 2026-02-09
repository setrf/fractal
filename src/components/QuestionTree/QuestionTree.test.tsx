import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QuestionTree } from './QuestionTree'
import { addNodeToTree, createEmptyTree, createQuestionNode } from '../../types/question'

vi.mock('../QuestionNode', () => ({
  QuestionNode: ({ node }: { node: { text: string } }) => <div>{node.text}</div>,
}))

function createProps() {
  return {
    onSelectNode: vi.fn(),
    onAddChild: vi.fn(),
    onToggleExpand: vi.fn(),
    onGenerateAI: vi.fn(),
    onLockIn: vi.fn(),
    conceptExplanations: {},
    conceptLoadingStates: {},
    conceptExplanation: null,
    isConceptLoading: false,
    conceptError: null,
    onConceptHover: vi.fn(),
    onConceptLeave: vi.fn(),
    onConceptClick: vi.fn(),
    onAddUserConcept: vi.fn(),
    onRemoveConcept: vi.fn(),
  }
}

describe('QuestionTree', () => {
  it('returns null for empty trees with no root', () => {
    const { container } = render(
      <QuestionTree
        tree={createEmptyTree()}
        {...createProps()}
      />
    )

    expect(container.firstChild).toBeNull()
  })

  it('handles ResizeObserver updates for expanded branches and disconnects on unmount', () => {
    const observe = vi.fn()
    const disconnect = vi.fn()
    const resizeCallbackRef: { current: (() => void) | null } = { current: null }

    class ResizeObserverMock {
      constructor(cb: () => void) {
        resizeCallbackRef.current = cb
      }
      observe = observe
      disconnect = disconnect
    }

    Object.defineProperty(window, 'ResizeObserver', {
      configurable: true,
      writable: true,
      value: ResizeObserverMock,
    })

    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      cb(0)
      return 1
    })

    let tree = createEmptyTree()
    const root = createQuestionNode('Root')
    root.meta.isExpanded = true
    tree = addNodeToTree(tree, root)
    const child = createQuestionNode('Child', root.id)
    child.meta.isExpanded = true
    tree = addNodeToTree(tree, child)

    const { unmount, container } = render(
      <QuestionTree
        tree={tree}
        {...createProps()}
      />
    )

    expect(screen.getByText('Root')).toBeInTheDocument()
    expect(screen.getByText('Child')).toBeInTheDocument()
    expect(observe).toHaveBeenCalled()

    // Trigger observer callback to execute connector recalculation path
    resizeCallbackRef.current?.()

    const connector = container.querySelector('[aria-hidden="true"]') as HTMLElement
    expect(connector).toBeInTheDocument()

    unmount()
    expect(disconnect).toHaveBeenCalled()

    rafSpy.mockRestore()
  })
})
