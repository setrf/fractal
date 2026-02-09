import { describe, expect, it } from 'vitest'
import { render, screen } from '../../test/test-utils'
import { GraphProvider } from '../../context/GraphContext'
import { GraphView } from './GraphView'
import { createEmptyTree, createQuestionNode, addNodeToTree } from '../../types/question'
import type { StashItem } from '../../types/stash'
import type { Probe } from '../../types/probe'
import type { ExtractedConcept } from '../../types/concept'

function renderGraph({
  includeRoot = true,
  nodeConcepts = {},
  stashItems = [],
  probes = [],
}: {
  includeRoot?: boolean
  nodeConcepts?: Record<string, ExtractedConcept[]>
  stashItems?: StashItem[]
  probes?: Probe[]
}) {
  let tree = createEmptyTree()
  if (includeRoot) {
    const root = createQuestionNode('Root question')
    tree = addNodeToTree(tree, root)
  }

  return render(
    <GraphProvider
      tree={tree}
      nodeConcepts={nodeConcepts}
      stashItems={stashItems}
      probes={probes}
    >
      <GraphView />
    </GraphProvider>
  )
}

describe('GraphView', () => {
  it('renders empty-state guidance when there are no non-question entities', () => {
    renderGraph({ includeRoot: false })
    expect(screen.getByText(/no entities to visualize yet/i)).toBeInTheDocument()
  })

  it('renders entity counts from graph context', () => {
    const concept: ExtractedConcept = {
      id: 'concept_1',
      text: 'dreams',
      normalizedName: 'dreams',
      category: 'psychology',
      startIndex: 0,
      endIndex: 6,
    }

    const stashItem: StashItem = {
      id: 'stash_1',
      type: 'question',
      content: 'Stored question',
      metadata: { questionId: 'missing-id' },
      createdAt: Date.now(),
    }

    const probe: Probe = {
      id: 'probe_1',
      name: 'Probe 1',
      color: 'blue',
      messages: [],
      selectedStashItemIds: ['stash_1'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    renderGraph({
      nodeConcepts: { concept_parent: [concept] },
      stashItems: [stashItem],
      probes: [probe],
    })

    expect(screen.getByText(/1 Questions/i)).toBeInTheDocument()
    expect(screen.getByText(/1 Concepts/i)).toBeInTheDocument()
    expect(screen.getByText(/1 Stash/i)).toBeInTheDocument()
    expect(screen.getByText(/1 Probes/i)).toBeInTheDocument()
  })
})
