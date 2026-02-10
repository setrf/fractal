import { useImperativeHandle, useState } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App, {
  computeBestBranchNodeIds,
  computeChildQualityScore,
  normalizeWeaveScore,
} from './App'
import type { ChatMessage, ExtractedConcept } from './api'
import type { StashItem } from './types/stash'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const harness = vi.hoisted(() => {
  type TreeNode = {
    id: string
    text: string
    parentId: string | null
    childIds: string[]
    meta: {
      qualityScore: number | null
      confidence: number | null
      uncertainty: number | null
      isExpanded: boolean
    }
  }

  const makeNode = (id: string, text: string, parentId: string | null, qualityScore: number | null): TreeNode => ({
    id,
    text,
    parentId,
    childIds: [],
    meta: {
      qualityScore,
      confidence: null,
      uncertainty: null,
      isExpanded: true,
    },
  })

  let rootCounter = 1
  let childCounter = 1

  const tree = {
    nodes: {} as Record<string, TreeNode>,
    rootId: null as string | null,
    activeId: null as string | null,
  }

  const setTreeEmpty = () => {
    tree.nodes = {}
    tree.rootId = null
    tree.activeId = null
    rootCounter = 1
    childCounter = 1
  }

  const setRoot = (id = 'root-1', text = 'Root question', qualityScore: number | null = 12) => {
    const root = makeNode(id, text, null, qualityScore)
    tree.nodes = { [id]: root }
    tree.rootId = id
    tree.activeId = id
    return root
  }

  const addRootQuestion = vi.fn((text: string) => {
    const id = `root-${rootCounter++}`
    const root = makeNode(id, text, null, null)
    tree.nodes = { ...tree.nodes, [id]: root }
    tree.rootId = id
    tree.activeId = id
    return id
  })

  const addChildQuestion = vi.fn(
    (
      parentId: string,
      text: string,
      options?: { qualityScore?: number | null; confidence?: number | null; uncertainty?: number | null }
    ) => {
      const parent = tree.nodes[parentId]
      if (!parent) return
      const childId = `child-${childCounter++}`
      const child = makeNode(childId, text, parentId, options?.qualityScore ?? null)
      child.meta.confidence = options?.confidence ?? null
      child.meta.uncertainty = options?.uncertainty ?? null
      tree.nodes = {
        ...tree.nodes,
        [parentId]: { ...parent, childIds: [...parent.childIds, childId] },
        [childId]: child,
      }
      tree.activeId = childId
    }
  )

  const setActiveNode = vi.fn((nodeId: string | null) => {
    tree.activeId = nodeId
  })

  const toggleNodeExpansion = vi.fn((nodeId: string) => {
    const node = tree.nodes[nodeId]
    if (!node) return
    tree.nodes = {
      ...tree.nodes,
      [nodeId]: {
        ...node,
        meta: { ...node.meta, isExpanded: !node.meta.isExpanded },
      },
    }
  })

  const updateNodeMeta = vi.fn(
    (
      nodeId: string,
      metaUpdates: Partial<{
        qualityScore: number | null
        confidence: number | null
        uncertainty: number | null
      }>
    ) => {
      const node = tree.nodes[nodeId]
      if (!node) return
      tree.nodes = {
        ...tree.nodes,
        [nodeId]: {
          ...node,
          meta: { ...node.meta, ...metaUpdates },
        },
      }
    }
  )

  const resetTree = vi.fn(() => {
    setTreeEmpty()
  })

  return {
    tree,
    setTreeEmpty,
    setRoot,
    addRootQuestion,
    addChildQuestion,
    setActiveNode,
    toggleNodeExpansion,
    updateNodeMeta,
    resetTree,
    stash: {
      isOpen: false,
      sidebarWidth: 300,
      items: [] as unknown[],
      setIsOpen: vi.fn(),
    },
    probe: {
      isOpen: false,
      sidebarWidth: 320,
      probes: [] as unknown[],
      activeProbe: null as { selectedStashItemIds: string[]; messages: unknown[] } | null,
      setIsOpen: vi.fn(),
    },
    viewMode: {
      isGraphView: false,
    },
    model: {
      selectedModel: 'left-model',
      models: ['left-model', 'right-model'],
    },
    ai: {
      generate: vi.fn(),
      isLoading: false,
      error: null as string | null,
      lastMeta: null as any,
    },
    eval: {
      stats: null as any,
      isLoading: false,
      error: null as string | null,
      refresh: vi.fn(),
    },
    conceptExtraction: {
      extract: vi.fn(),
    },
    conceptExplanation: {
      explanation: null as any,
      explanations: {} as Record<string, unknown>,
      loadingStates: {} as Record<string, { isLoading?: boolean; error?: string | null }>,
      isLoading: false,
      error: null as string | null,
      fetchExplanation: vi.fn(),
      reset: vi.fn(),
    },
    onboarding: {
      isOpen: false,
      currentStep: 0,
      hasCompleted: false,
      next: vi.fn(),
      prev: vi.fn(),
      skip: vi.fn(),
      restart: vi.fn(),
    },
    onboardingSteps: [] as any[],
    graph: {
      options: null as { onDeepDive?: (parentId: string, question: string) => void; onChat?: (nodeId: string, question: string) => void } | null,
      graphPopupNode: null as any,
      graphPopupPosition: { x: 120, y: 90 },
      handleGraphNodeClick: vi.fn(),
      handleGraphPopupClose: vi.fn(),
      handleGraphDeepDive: vi.fn(),
      handleGraphChat: vi.fn(),
    },
    graphRef: {
      resetCamera: vi.fn(),
      zoomIn: vi.fn(),
      zoomOut: vi.fn(),
    },
    api: {
      compareQuestionGenerations: vi.fn(),
      sendChatMessage: vi.fn(),
    },
    isMobile: false,
    findPosition: vi.fn((x: number, y: number) => ({ x: x + 1, y: y + 1 })),
  }
})

vi.mock('./api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api')>()
  return {
    ...actual,
    compareQuestionGenerations: (...args: Parameters<typeof actual.compareQuestionGenerations>) =>
      harness.api.compareQuestionGenerations(...args),
    sendChatMessage: (...args: Parameters<typeof actual.sendChatMessage>) =>
      harness.api.sendChatMessage(...args),
  }
})

vi.mock('./hooks/useQuestionTree', () => ({
  useQuestionTree: () => ({
    tree: harness.tree,
    rootNode: harness.tree.rootId ? harness.tree.nodes[harness.tree.rootId] : null,
    activeNode: harness.tree.activeId ? harness.tree.nodes[harness.tree.activeId] : null,
    addRootQuestion: harness.addRootQuestion,
    addChildQuestion: harness.addChildQuestion,
    setActiveNode: harness.setActiveNode,
    toggleNodeExpansion: harness.toggleNodeExpansion,
    updateNodeMeta: harness.updateNodeMeta,
    reset: harness.resetTree,
  }),
}))

vi.mock('./hooks/useAIQuestions', () => ({
  useAIQuestions: () => ({
    generate: harness.ai.generate,
    isLoading: harness.ai.isLoading,
    error: harness.ai.error,
    lastMeta: harness.ai.lastMeta,
  }),
}))

vi.mock('./hooks/useEvalStats', () => ({
  useEvalStats: () => ({
    stats: harness.eval.stats,
    isLoading: harness.eval.isLoading,
    error: harness.eval.error,
    refresh: harness.eval.refresh,
  }),
}))

vi.mock('./hooks/useConceptExtraction', () => ({
  useConceptExtraction: () => ({
    extract: harness.conceptExtraction.extract,
  }),
}))

vi.mock('./hooks/useConceptExplanation', () => ({
  useConceptExplanation: () => ({
    explanation: harness.conceptExplanation.explanation,
    explanations: harness.conceptExplanation.explanations,
    loadingStates: harness.conceptExplanation.loadingStates,
    isLoading: harness.conceptExplanation.isLoading,
    error: harness.conceptExplanation.error,
    fetchExplanation: harness.conceptExplanation.fetchExplanation,
    reset: harness.conceptExplanation.reset,
  }),
}))

vi.mock('./hooks/useOnboarding', () => ({
  useOnboarding: () => harness.onboarding,
}))

vi.mock('./hooks/useOnboardingSteps', () => ({
  useOnboardingSteps: () => harness.onboardingSteps,
}))

vi.mock('./hooks/useGraphInteractions', () => ({
  useGraphInteractions: (
    options: { onDeepDive?: (parentId: string, question: string) => void; onChat?: (nodeId: string, question: string) => void }
  ) => {
    harness.graph.options = options
    return {
      graphPopupNode: harness.graph.graphPopupNode,
      graphPopupPosition: harness.graph.graphPopupPosition,
      handleGraphNodeClick: harness.graph.handleGraphNodeClick,
      handleGraphPopupClose: harness.graph.handleGraphPopupClose,
      handleGraphDeepDive: harness.graph.handleGraphDeepDive,
      handleGraphChat: harness.graph.handleGraphChat,
    }
  },
}))

vi.mock('./hooks/useIsMobile', () => ({
  useIsMobile: () => harness.isMobile,
}))

vi.mock('./context/StashContext', () => ({
  StashProvider: ({ children }: { children: React.ReactNode }) => children,
  useStashContext: () => harness.stash,
}))

vi.mock('./context/ProbeContext', () => ({
  ProbeProvider: ({ children }: { children: React.ReactNode }) => children,
  useProbeContext: () => harness.probe,
}))

vi.mock('./context/GraphContext', () => ({
  GraphProvider: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock('./context/ViewModeContext', () => ({
  ViewModeProvider: ({ children }: { children: React.ReactNode }) => children,
  useViewModeContext: () => harness.viewMode,
}))

vi.mock('./context/ModelContext', () => ({
  ModelProvider: ({ children }: { children: React.ReactNode }) => children,
  useModelContext: () => harness.model,
}))

vi.mock('./components/ThemeToggle', () => ({
  ThemeToggle: ({ rightOffset }: { rightOffset: number }) => <div data-testid="theme-toggle">{`theme:${rightOffset}`}</div>,
}))

vi.mock('./components/ViewModeToggle', () => ({
  ViewModeToggle: ({ rightOffset }: { rightOffset: number }) => (
    <div data-testid="view-mode-toggle">{`view:${rightOffset}`}</div>
  ),
}))

vi.mock('./components/ModelSelector', () => ({
  ModelSelector: ({ rightOffset }: { rightOffset: number }) => (
    <div data-testid="model-selector">{`model:${rightOffset}`}</div>
  ),
}))

vi.mock('./components/QuestionInput', () => ({
  QuestionInput: ({ onSubmit }: { onSubmit: (question: string) => void }) => (
    <button aria-label="mock-submit-root" onClick={() => onSubmit('Seed question from mock')}>
      submit seed
    </button>
  ),
}))

vi.mock('./components/QuestionTree', () => ({
  QuestionTree: (props: any) => {
    const rootId = harness.tree.rootId ?? 'root-1'
    const concept: ExtractedConcept = {
      id: 'tree-popup',
      text: 'Tree Popup',
      normalizedName: 'tree popup',
      category: 'abstract',
      startIndex: 0,
      endIndex: 10,
    }
    const customConcept: ExtractedConcept = {
      id: 'user-concept',
      text: 'User Concept',
      normalizedName: 'user concept',
      category: 'science',
      startIndex: 3,
      endIndex: 9,
    }
    return (
      <div data-testid="mock-question-tree">
        <button aria-label="tree-select-node" onClick={() => props.onSelectNode(rootId)}>
          select node
        </button>
        <button aria-label="tree-select-missing" onClick={() => props.onSelectNode('missing-node')}>
          select missing
        </button>
        <button aria-label="tree-add-child" onClick={() => props.onAddChild(rootId, 'Manual child')}>
          add child
        </button>
        <button aria-label="tree-toggle-expand" onClick={() => props.onToggleExpand(rootId)}>
          toggle
        </button>
        <button aria-label="tree-generate" onClick={() => props.onGenerateAI(rootId, 'Generate from tree')}>
          generate
        </button>
        <button
          aria-label="tree-lock-in"
          onClick={() => props.onLockIn(rootId, harness.tree.nodes[rootId]?.text ?? 'Fallback lock-in question')}
        >
          lock in
        </button>
        <button aria-label="tree-concept-hover" onClick={() => props.onConceptHover(concept, 'Tree context')}>
          hover concept
        </button>
        <button aria-label="tree-concept-hover-no-context" onClick={() => props.onConceptHover(concept)}>
          hover concept no context
        </button>
        <button aria-label="tree-concept-click" onClick={() => props.onConceptClick(concept, 'Tree context')}>
          click concept
        </button>
        <button aria-label="tree-concept-click-no-context" onClick={() => props.onConceptClick(concept)}>
          click concept no context
        </button>
        <button aria-label="tree-add-user-concept" onClick={() => props.onAddUserConcept(rootId, customConcept)}>
          add user concept
        </button>
        <button aria-label="tree-remove-user-concept" onClick={() => props.onRemoveConcept(rootId, 'user-concept')}>
          remove user concept
        </button>
        <button
          aria-label="tree-remove-missing-concept"
          onClick={() => props.onRemoveConcept('missing-node', 'missing-concept')}
        >
          remove missing concept
        </button>
        <button aria-label="tree-open-popup" onClick={() => props.onOpenPopup(concept, { x: 10, y: 20 })}>
          open popup
        </button>
        <button
          aria-label="tree-open-popup-second"
          onClick={() =>
            props.onOpenPopup(
              {
                ...concept,
                id: 'tree-popup-second',
                text: 'Tree Popup Two',
                normalizedName: 'tree popup two',
              },
              { x: 20, y: 30 }
            )
          }
        >
          open second popup
        </button>
        <button
          aria-label="tree-open-popup-duplicate"
          onClick={() => props.onOpenPopup({ ...concept, id: 'tree-popup-2' }, { x: 18, y: 28 })}
        >
          open duplicate popup
        </button>
        <div data-testid="tree-generating-node">{props.generatingNodeId ?? ''}</div>
      </div>
    )
  },
}))

vi.mock('./components/ChatView', () => ({
  ChatView: (props: any) => {
    const [result, setResult] = useState('')
    const concept: ExtractedConcept = {
      id: 'chat-concept',
      text: 'Chat Concept',
      normalizedName: 'chat concept',
      category: 'psychology',
      startIndex: 0,
      endIndex: 10,
    }

    return (
      <div data-testid="mock-chat-view">
        <div>{`chat-question:${props.question}`}</div>
        <div data-testid="chat-concepts-count">{String((props.concepts ?? []).length)}</div>
        <button aria-label="chat-back" onClick={props.onBack}>
          back
        </button>
        <button
          aria-label="chat-send"
          onClick={async () => {
            try {
              const value = await props.onSendMessage([
                { role: 'assistant', content: 'preface' },
                { role: 'user', content: 'hello from chat' },
              ] as ChatMessage[])
              setResult(value)
            } catch (error) {
              setResult((error as Error).message)
            }
          }}
        >
          send
        </button>
        <button aria-label="chat-hover" onClick={() => props.onConceptHover(concept)}>
          hover
        </button>
        <button aria-label="chat-click" onClick={() => props.onConceptClick(concept)}>
          click
        </button>
        <button
          aria-label="chat-open-popup"
          onClick={() => props.onOpenPopup?.(concept, { x: 30, y: 40 })}
        >
          open chat popup
        </button>
        <button aria-label="chat-extract" onClick={() => props.extractConcepts?.('chat extraction text')}>
          extract
        </button>
        <div data-testid="chat-result">{result}</div>
        <div data-testid="chat-minimize-trigger">{String(props.minimizeAllTrigger ?? 0)}</div>
        <div data-testid="chat-close-trigger">{String(props.closeAllTrigger ?? 0)}</div>
      </div>
    )
  },
}))

vi.mock('./components/StashSidebar', () => ({
  StashSidebar: ({ onItemClick }: { onItemClick: (item: StashItem) => void }) => {
    const createItem = (
      id: string,
      type: StashItem['type'],
      content: string,
      metadata: StashItem['metadata']
    ): StashItem => ({
      id,
      type,
      content,
      metadata,
      createdAt: Date.now(),
    })

    return (
      <div data-testid="mock-stash-sidebar">
        <button
          aria-label="stash-open-note"
          onClick={() =>
            onItemClick(createItem('s-note', 'note', 'Note content', { title: 'Saved note title' }))
          }
        >
          note
        </button>
        <button
          aria-label="stash-open-note-untitled"
          onClick={() =>
            onItemClick(createItem('s-note-untitled', 'note', 'Untitled note content', {}))
          }
        >
          note untitled
        </button>
        <button
          aria-label="stash-open-explanation"
          onClick={() =>
            onItemClick(
              createItem('s-expl', 'explanation', 'Quantum idea', {
                normalizedName: 'quantum idea',
                conceptCategory: 'science',
                summary: 'Summary',
                context: 'Context',
                relatedConcepts: ['Entanglement'],
              })
            )
          }
        >
          explanation
        </button>
        <button
          aria-label="stash-open-explanation-minimal"
          onClick={() =>
            onItemClick(
              createItem('s-expl-min', 'explanation', 'Sparse explanation', {})
            )
          }
        >
          explanation minimal
        </button>
        <button
          aria-label="stash-open-question"
          onClick={() => onItemClick(createItem('s-q', 'question', 'Question stash', {}))}
        >
          question
        </button>
        <button
          aria-label="stash-open-highlight"
          onClick={() =>
            onItemClick(
              createItem('s-h', 'highlight', 'Highlight stash', {
                normalizedName: 'highlight name',
              })
            )
          }
        >
          highlight
        </button>
        <button
          aria-label="stash-open-highlight-minimal"
          onClick={() =>
            onItemClick(
              createItem('s-h-min', 'highlight', 'Highlight without normalized metadata', {})
            )
          }
        >
          highlight minimal
        </button>
        <button
          aria-label="stash-open-chat-assistant"
          onClick={() => onItemClick(createItem('s-ca', 'chat-message', 'Assistant reply', { role: 'assistant' }))}
        >
          chat assistant
        </button>
        <button
          aria-label="stash-open-chat-user"
          onClick={() => onItemClick(createItem('s-cu', 'chat-message', 'User reply', { role: 'user' }))}
        >
          chat user
        </button>
        <button
          aria-label="stash-open-unknown"
          onClick={() =>
            onItemClick(
              {
                id: 's-unknown',
                type: 'mystery',
                content: 'Unknown payload',
                metadata: {},
                createdAt: Date.now(),
              } as unknown as StashItem
            )
          }
        >
          unknown
        </button>
      </div>
    )
  },
}))

vi.mock('./components/ProbeSidebar', () => ({
  ProbeSidebar: () => <div data-testid="mock-probe-sidebar" />,
}))

vi.mock('./components/NotePopup', () => ({
  NotePopup: (props: any) => (
    <div data-testid={`note-popup-${props.id}`}>
      <div>{`note:${props.initialTitle}:${props.initialContent}`}</div>
      <div>{`stack:${String(props.minimizedStackIndex)}`}</div>
      <div>{`readonly:${String(props.readOnly)}`}</div>
      <div>{`source:${String(props.sourceType)}`}</div>
      <button aria-label={`note-update-${props.id}`} onClick={() => props.onUpdate(props.id, 'Updated title', 'Updated content')}>
        update note
      </button>
      <button aria-label={`note-minimize-${props.id}`} onClick={() => props.onMinimizeChange(props.id, true)}>
        minimize note
      </button>
      <button aria-label={`note-close-${props.id}`} onClick={props.onClose}>
        close note
      </button>
    </div>
  ),
}))

vi.mock('./components/ConceptPopup', () => ({
  ConceptPopup: (props: any) => (
    <div data-testid={`concept-popup-${props.concept.id}`}>
      <div>{`concept:${props.concept.normalizedName}`}</div>
      <div>{`loading:${String(Boolean(props.isLoading))}`}</div>
      <div>{`error:${props.error ?? ''}`}</div>
      <div>{`stack:${String(props.minimizedStackIndex)}`}</div>
      <div>{`ext-min:${String(props.externalIsMinimized)}`}</div>
      <button aria-label={`concept-close-${props.concept.id}`} onClick={props.onClose}>
        close concept
      </button>
      <button
        aria-label={`concept-related-${props.concept.id}`}
        onClick={() => props.onRelatedConceptClick?.('Related Term')}
      >
        related concept
      </button>
      <button
        aria-label={`concept-minimize-${props.concept.id}`}
        onClick={() => props.onMinimizeChange?.(props.concept.id, true)}
      >
        minimize concept
      </button>
    </div>
  ),
  DEFAULT_POPUP_WIDTH: 360,
  DEFAULT_POPUP_HEIGHT: 320,
  findNonOverlappingPosition: (x: number, y: number, existing: unknown[]) =>
    harness.findPosition(x, y, existing),
}))

vi.mock('./components/MobileHeader/MobileHeader', () => ({
  MobileHeader: (props: any) => (
    <div data-testid="mock-mobile-header">
      <button aria-label="mobile-open-onboarding" onClick={props.onOpenOnboarding}>
        open onboarding
      </button>
      <button aria-label="mobile-create-note" onClick={props.onCreateNote}>
        create note
      </button>
      <button aria-label="mobile-minimize-all" onClick={props.onMinimizeAll}>
        minimize all
      </button>
      <button aria-label="mobile-close-all" onClick={props.onCloseAll}>
        close all
      </button>
    </div>
  ),
}))

vi.mock('./components/EvalPanel', () => ({
  EvalPanel: ({ onRefresh }: { onRefresh: () => void }) => (
    <button aria-label="refresh-eval-panel" onClick={onRefresh}>
      refresh eval
    </button>
  ),
}))

vi.mock('./components/ReplayTimeline', () => ({
  ReplayTimeline: ({ events }: { events: unknown[] }) => <div data-testid="replay-timeline">{`events:${events.length}`}</div>,
}))

vi.mock('./components/GraphControls', () => ({
  GraphControls: (props: any) => (
    <div data-testid="mock-graph-controls">
      <button aria-label="graph-reset-camera" onClick={props.onResetCamera}>
        reset
      </button>
      <button aria-label="graph-zoom-in" onClick={props.onZoomIn}>
        in
      </button>
      <button aria-label="graph-zoom-out" onClick={props.onZoomOut}>
        out
      </button>
      <div>{`graph-right:${props.rightOffset}`}</div>
    </div>
  ),
}))

vi.mock('./components/GraphNodePopup', () => ({
  GraphNodePopup: (props: any) => (
    <div data-testid="mock-graph-node-popup">
      <div>{`best:${String(props.isBestBranch)}`}</div>
      <button aria-label="graph-popup-close" onClick={props.onClose}>
        close graph popup
      </button>
      <button aria-label="graph-popup-deep-dive" onClick={props.onDeepDive}>
        graph deep dive
      </button>
      <button aria-label="graph-popup-chat" onClick={props.onChat}>
        graph chat
      </button>
    </div>
  ),
}))

vi.mock('./components/Onboarding', () => ({
  OnboardingOverlay: (props: any) => (
    <div data-testid="mock-onboarding-overlay">
      <div>{`open:${String(props.isOpen)} canProceed:${String(props.canProceed)} step:${props.stepIndex}/${props.totalSteps}`}</div>
      <button aria-label="onboarding-next" onClick={props.onNext}>
        next
      </button>
      <button aria-label="onboarding-prev" onClick={props.onPrev}>
        prev
      </button>
      <button aria-label="onboarding-skip" onClick={props.onSkip}>
        skip
      </button>
      <button aria-label="onboarding-restart" onClick={props.onRestart}>
        restart
      </button>
      <button aria-label="onboarding-close" onClick={props.onClose}>
        close
      </button>
    </div>
  ),
}))

vi.mock('./components/GraphView', async () => {
  const React = await import('react')

  const GraphView = React.forwardRef(function MockGraphView(
    props: { onNodeClick?: (node: unknown) => void; leftOffset?: number },
    ref: React.ForwardedRef<unknown>
  ) {
    useImperativeHandle(ref, () => harness.graphRef, [])

    return (
      <div data-testid="mock-graph-view">
        <div>{`leftOffset:${String(props.leftOffset)}`}</div>
        <button
          aria-label="graph-node-click"
          onClick={() => props.onNodeClick?.({ id: harness.tree.rootId ?? 'graph-node' })}
        >
          graph node click
        </button>
      </div>
    )
  })

  return { GraphView }
})

function resetHarnessState() {
  harness.setTreeEmpty()
  harness.stash.isOpen = false
  harness.stash.sidebarWidth = 300
  harness.stash.items = []
  harness.probe.isOpen = false
  harness.probe.sidebarWidth = 320
  harness.probe.probes = []
  harness.probe.activeProbe = null
  harness.viewMode.isGraphView = false
  harness.model.selectedModel = 'left-model'
  harness.model.models = ['left-model', 'right-model']
  harness.isMobile = false
  harness.ai.isLoading = false
  harness.ai.error = null
  harness.ai.lastMeta = null
  harness.ai.generate.mockResolvedValue({
    questions: ['AI child one', 'AI child two'],
    meta: {
      qualityScore: 8.2,
      confidence: 0.64,
      uncertainty: 0.22,
      promptLabel: 'Default prompt',
      promptVariant: 'v1',
      evalModel: 'provider/default-model',
      strengths: [],
      weaknesses: [],
      costGuard: {
        isNearLimit: false,
        usedTokens: 0,
        maxTokensPerSession: 1000,
      },
    },
  })

  harness.eval.stats = null
  harness.eval.isLoading = false
  harness.eval.error = null
  harness.eval.refresh.mockResolvedValue(undefined)

  harness.conceptExtraction.extract.mockResolvedValue([
    {
      id: 'concept-1',
      text: 'concept',
      normalizedName: 'concept',
      category: 'abstract',
      startIndex: 0,
      endIndex: 7,
    },
  ])

  harness.conceptExplanation.explanation = null
  harness.conceptExplanation.explanations = {}
  harness.conceptExplanation.loadingStates = {}
  harness.conceptExplanation.isLoading = false
  harness.conceptExplanation.error = null
  harness.conceptExplanation.fetchExplanation.mockResolvedValue(undefined)
  harness.conceptExplanation.reset.mockResolvedValue(undefined)

  harness.onboarding.isOpen = false
  harness.onboarding.currentStep = 0
  harness.onboarding.hasCompleted = false
  harness.onboardingSteps = [
    {
      title: 'Mock step',
      body: 'Body',
      canProceed: () => true,
      autoAdvance: false,
      onEnter: vi.fn(),
    },
  ]

  harness.graph.options = null
  harness.graph.graphPopupNode = null
  harness.graph.graphPopupPosition = { x: 120, y: 90 }
  harness.graph.handleGraphNodeClick.mockImplementation(() => undefined)
  harness.graph.handleGraphPopupClose.mockImplementation(() => {
    harness.graph.graphPopupNode = null
  })
  harness.graph.handleGraphDeepDive.mockImplementation(() => {
    harness.graph.options?.onDeepDive?.(harness.tree.rootId ?? 'root-1', 'Graph deep dive question')
  })
  harness.graph.handleGraphChat.mockImplementation(() => {
    harness.graph.options?.onChat?.(harness.tree.rootId ?? 'root-1', 'Graph chat question')
  })

  harness.api.compareQuestionGenerations.mockResolvedValue({
    question: 'Compare seed',
    left: {
      questions: ['Left A', 'Left B'],
      meta: {
        qualityScore: 6.5,
        confidence: 0.5,
        uncertainty: 0.2,
        promptLabel: 'Left prompt',
      },
    },
    right: {
      questions: ['Right A', 'Right B'],
      meta: {
        qualityScore: 7.4,
        confidence: 0.62,
        uncertainty: 0.18,
        promptLabel: 'Right prompt',
      },
    },
    winner: 'right',
    reason: 'Right side was more specific.',
  })
  harness.api.sendChatMessage.mockResolvedValue('Chat response from API')
  harness.findPosition.mockImplementation((x: number, y: number) => ({ x: x + 1, y: y + 1 }))
}

describe('App helper utilities', () => {
  it('normalizes scores and computes quality progression correctly', () => {
    expect(normalizeWeaveScore(undefined)).toBeNull()
    expect(normalizeWeaveScore(Number.NaN)).toBeNull()
    expect(normalizeWeaveScore(-4)).toBe(0)
    expect(normalizeWeaveScore(4.3)).toBe(4.3)
    expect(normalizeWeaveScore(10)).toBeCloseTo(9.999)
    expect(normalizeWeaveScore(99)).toBeCloseTo(9.999)

    expect(computeChildQualityScore(4, null)).toBeCloseTo(4.6)
    expect(computeChildQualityScore(4, 3)).toBeCloseTo(4.6)
    expect(computeChildQualityScore(4, 8)).toBe(8)
  })

  it('returns best-branch node IDs from a weighted tree', () => {
    expect(computeBestBranchNodeIds({ rootId: null, nodes: {} })).toEqual(new Set())
    expect(
      computeBestBranchNodeIds({
        rootId: 'missing',
        nodes: {},
      })
    ).toEqual(new Set())

    const result = computeBestBranchNodeIds({
      rootId: 'root',
      nodes: {
        root: { id: 'root', childIds: ['a', 'b'], meta: { qualityScore: 1 } },
        a: { id: 'a', childIds: ['a1'], meta: { qualityScore: 2 } },
        a1: { id: 'a1', childIds: [], meta: { qualityScore: 2 } },
        b: { id: 'b', childIds: ['b1'], meta: { qualityScore: 3 } },
        b1: { id: 'b1', childIds: [], meta: { qualityScore: 4 } },
      },
    })

    expect(result).toEqual(new Set(['root', 'b', 'b1']))
  })

  it('skips missing descendants while traversing best branch candidates', () => {
    const result = computeBestBranchNodeIds({
      rootId: 'root',
      nodes: {
        root: { id: 'root', childIds: ['missing-child', 'leaf'], meta: { qualityScore: 2 } },
        leaf: { id: 'leaf', childIds: [], meta: { qualityScore: 5 } },
      },
    })

    expect(result).toEqual(new Set(['root', 'leaf']))
  })
})

describe('App behavior coverage harness', () => {
  beforeEach(() => {
    resetHarnessState()
    vi.useRealTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
  })

  it('exercises desktop tree, compare, popup, stash, chat, and reset flows', async () => {
    harness.onboarding.isOpen = true
    harness.onboarding.hasCompleted = true
    harness.ai.error = 'Mock AI outage'
    harness.ai.lastMeta = {
      qualityScore: 8.4,
      promptLabel: 'Judge Prompt',
      promptVariant: 'variant-a',
      evalModel: 'provider/eval-model',
      confidence: 0.66,
      uncertainty: 0.22,
      strengths: ['Strong framing'],
      weaknesses: ['Could add constraints'],
      costGuard: {
        isNearLimit: true,
        usedTokens: 180,
        maxTokensPerSession: 240,
      },
    }
    harness.eval.stats = {
      costGuard: {
        isNearLimit: true,
        usedTokens: 200,
        maxTokensPerSession: 240,
      },
    }
    harness.conceptExplanation.loadingStates = {
      'tree-popup': { isLoading: true, error: 'loading issue' },
    }

    render(<App />)

    expect(screen.getByRole('button', { name: 'mock-submit-root' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'mock-submit-root' }))

    await waitFor(() => {
      expect(screen.getByTestId('mock-question-tree')).toBeInTheDocument()
    })

    expect(screen.getByText(/AI Error: Mock AI outage/i)).toBeInTheDocument()
    expect(screen.getByText(/Token budget warning:/i)).toBeInTheDocument()
    expect(screen.getByText(/Judge strengths:/i)).toBeInTheDocument()
    expect(screen.getByText(/Judge weaknesses:/i)).toBeInTheDocument()

    const createNoteButton = screen.getByRole('button', { name: /create new note/i })
    const minimizeAllButton = screen.getByRole('button', { name: /minimize all popups/i })
    const closeAllButton = screen.getByRole('button', { name: /close all popups/i })
    const startOnboardingButton = screen.getByRole('button', { name: /start onboarding tour/i })

    fireEvent.mouseOver(createNoteButton)
    fireEvent.mouseOut(createNoteButton)
    fireEvent.mouseOver(minimizeAllButton)
    fireEvent.mouseOut(minimizeAllButton)
    fireEvent.mouseOver(closeAllButton)
    fireEvent.mouseOut(closeAllButton)
    fireEvent.mouseOver(startOnboardingButton)
    fireEvent.mouseOut(startOnboardingButton)

    fireEvent.click(createNoteButton)
    expect(screen.getAllByTestId(/note-popup-/).length).toBeGreaterThanOrEqual(1)

    fireEvent.click(screen.getByRole('button', { name: /note-update-/ }))
    fireEvent.click(screen.getByRole('button', { name: /note-minimize-/ }))
    fireEvent.click(screen.getByRole('button', { name: /note-close-/ }))

    fireEvent.click(screen.getByRole('button', { name: 'tree-select-node' }))
    fireEvent.click(screen.getByRole('button', { name: 'tree-select-node' }))
    fireEvent.click(screen.getByRole('button', { name: 'tree-select-missing' }))
    fireEvent.click(screen.getByRole('button', { name: 'tree-add-child' }))
    fireEvent.click(screen.getByRole('button', { name: 'tree-toggle-expand' }))
    fireEvent.click(screen.getByRole('button', { name: 'tree-concept-hover' }))
    fireEvent.click(screen.getByRole('button', { name: 'tree-concept-click' }))
    fireEvent.click(screen.getByRole('button', { name: 'tree-add-user-concept' }))
    fireEvent.click(screen.getByRole('button', { name: 'tree-remove-user-concept' }))

    fireEvent.click(screen.getByRole('button', { name: 'tree-open-popup' }))
    fireEvent.click(screen.getByRole('button', { name: 'tree-open-popup-second' }))
    fireEvent.click(screen.getByRole('button', { name: 'tree-open-popup-duplicate' }))
    expect(screen.getAllByTestId(/concept-popup-/).length).toBeGreaterThanOrEqual(1)

    fireEvent.click(screen.getByRole('button', { name: 'concept-minimize-tree-popup' }))
    fireEvent.click(screen.getByRole('button', { name: 'concept-related-tree-popup' }))

    await waitFor(() => {
      const related = screen.getAllByTestId(/concept-popup-related_/)
      expect(related.length).toBeGreaterThanOrEqual(1)
    })

    fireEvent.click(screen.getByRole('button', { name: 'concept-close-tree-popup' }))

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'right-model' } })
    fireEvent.click(screen.getByRole('button', { name: /Run Compare/i }))
    await screen.findByText(/Winner:/i)
    fireEvent.click(screen.getByRole('button', { name: /Apply Left/i }))
    fireEvent.click(screen.getByRole('button', { name: /Apply Right/i }))

    harness.api.compareQuestionGenerations.mockRejectedValueOnce(new Error('compare failed'))
    fireEvent.click(screen.getByRole('button', { name: /Run Compare/i }))
    expect(await screen.findByText(/Compare error: compare failed/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'refresh-eval-panel' }))
    expect(harness.eval.refresh).toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'stash-open-note' }))
    fireEvent.click(screen.getByRole('button', { name: 'stash-open-explanation' }))
    fireEvent.click(screen.getByRole('button', { name: 'stash-open-question' }))
    fireEvent.click(screen.getByRole('button', { name: 'stash-open-highlight' }))
    fireEvent.click(screen.getByRole('button', { name: 'stash-open-chat-assistant' }))
    fireEvent.click(screen.getByRole('button', { name: 'stash-open-chat-user' }))

    const conceptPopups = screen.getAllByTestId(/concept-popup-/)
    const reopenedPopup = conceptPopups.find((popup) => popup.getAttribute('data-testid')?.includes('reopened-popup-'))
    expect(reopenedPopup).toBeTruthy()

    if (reopenedPopup) {
      const popupId = reopenedPopup.getAttribute('data-testid')!.replace('concept-popup-', '')
      fireEvent.click(screen.getByRole('button', { name: `concept-minimize-${popupId}` }))
      fireEvent.click(screen.getByRole('button', { name: `concept-close-${popupId}` }))
    }

    fireEvent.click(screen.getByRole('button', { name: 'stash-open-explanation' }))
    fireEvent.click(minimizeAllButton)
    fireEvent.click(closeAllButton)

    expect(screen.queryByTestId(/note-popup-/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'tree-lock-in' }))
    await waitFor(() => {
      expect(screen.getByTestId('mock-chat-view')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'chat-send' }))
    await waitFor(() => {
      expect(screen.getByTestId('chat-result')).toHaveTextContent('Chat response from API')
    })

    fireEvent.click(screen.getByRole('button', { name: 'chat-hover' }))
    fireEvent.click(screen.getByRole('button', { name: 'chat-click' }))
    fireEvent.click(screen.getByRole('button', { name: 'chat-open-popup' }))
    fireEvent.click(screen.getByRole('button', { name: 'chat-extract' }))
    fireEvent.click(screen.getByRole('button', { name: 'chat-back' }))

    await waitFor(() => {
      expect(screen.getByTestId('mock-question-tree')).toBeInTheDocument()
    })

    fireEvent.click(startOnboardingButton)
    fireEvent.click(screen.getByRole('button', { name: 'onboarding-next' }))
    fireEvent.click(screen.getByRole('button', { name: 'onboarding-prev' }))
    fireEvent.click(screen.getByRole('button', { name: 'onboarding-skip' }))
    fireEvent.click(screen.getByRole('button', { name: 'onboarding-restart' }))
    fireEvent.click(screen.getByRole('button', { name: 'onboarding-close' }))

    const startOverButton = screen.getByRole('button', { name: /Start over/i })
    fireEvent.mouseOver(startOverButton)
    fireEvent.mouseOut(startOverButton)
    fireEvent.click(startOverButton)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'mock-submit-root' })).toBeInTheDocument()
    })

    expect(harness.addRootQuestion).toHaveBeenCalled()
    expect(harness.addChildQuestion).toHaveBeenCalled()
    expect(harness.updateNodeMeta).toHaveBeenCalled()
    expect(harness.conceptExplanation.fetchExplanation).toHaveBeenCalled()
    expect(harness.resetTree).toHaveBeenCalled()
    expect(harness.conceptExplanation.reset).toHaveBeenCalled()
  })

  it('ignores stale concept extraction and generation responses', async () => {
    harness.setRoot('root-1', 'Stale handling root', 13)

    const extractFirst = deferred<ExtractedConcept[]>()
    const extractSecond = deferred<ExtractedConcept[]>()
    harness.conceptExtraction.extract
      .mockImplementationOnce(() => extractFirst.promise)
      .mockImplementationOnce(() => extractSecond.promise)

    const generateFirst = deferred<{ questions: string[]; meta: any }>()
    const generateSecond = deferred<{ questions: string[]; meta: any }>()
    harness.ai.generate
      .mockImplementationOnce(() => generateFirst.promise)
      .mockImplementationOnce(() => generateSecond.promise)

    render(<App />)
    expect(screen.getByTestId('mock-question-tree')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'tree-select-node' }))

    await act(async () => {
      extractFirst.resolve([
        {
          id: 'stale-extract',
          text: 'stale',
          normalizedName: 'stale',
          category: 'abstract',
          startIndex: 0,
          endIndex: 5,
        },
      ])
    })

    await act(async () => {
      extractSecond.resolve([
        {
          id: 'fresh-extract',
          text: 'fresh',
          normalizedName: 'fresh',
          category: 'science',
          startIndex: 0,
          endIndex: 5,
        },
      ])
    })

    fireEvent.click(screen.getByRole('button', { name: 'tree-select-node' }))
    expect(harness.conceptExtraction.extract).toHaveBeenCalledTimes(2)

    fireEvent.click(screen.getByRole('button', { name: 'tree-generate' }))
    fireEvent.click(screen.getByRole('button', { name: 'tree-generate' }))

    await act(async () => {
      generateFirst.resolve({
        questions: ['stale question'],
        meta: {
          qualityScore: 4.2,
          confidence: 0.4,
          uncertainty: 0.3,
          promptLabel: 'stale',
        },
      })
    })

    await act(async () => {
      generateSecond.resolve({
        questions: ['fresh question'],
        meta: {
          qualityScore: 7.1,
          confidence: 0.75,
          uncertainty: 0.16,
          promptLabel: 'fresh',
        },
      })
    })

    await waitFor(() => {
      expect(harness.addChildQuestion).toHaveBeenCalledWith(
        'root-1',
        'fresh question',
        expect.objectContaining({
          qualityScore: expect.any(Number),
        })
      )
    })

    expect(
      harness.addChildQuestion.mock.calls.some(
        (call) => call[0] === 'root-1' && call[1] === 'stale question'
      )
    ).toBe(false)
  })

  it('renders graph mode with lazy graph view, controls, and popup callbacks', async () => {
    const root = harness.setRoot('root-graph', 'Graph root', 6)
    const childA = {
      id: 'graph-a',
      text: 'Graph child A',
      parentId: root.id,
      childIds: [],
      meta: { qualityScore: 2, confidence: null, uncertainty: null, isExpanded: true },
    }
    const childB = {
      id: 'graph-b',
      text: 'Graph child B',
      parentId: root.id,
      childIds: [],
      meta: { qualityScore: 8, confidence: null, uncertainty: null, isExpanded: true },
    }
    harness.tree.nodes = {
      [root.id]: { ...root, childIds: [childA.id, childB.id] },
      [childA.id]: childA,
      [childB.id]: childB,
    }
    harness.tree.rootId = root.id
    harness.tree.activeId = root.id

    harness.viewMode.isGraphView = true
    harness.graph.graphPopupNode = { id: 'graph-b', label: 'Graph popup node' }

    render(<App />)

    expect(screen.getByText(/Loading graph/i)).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByTestId('mock-graph-view')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'graph-node-click' }))
    fireEvent.click(screen.getByRole('button', { name: 'graph-reset-camera' }))
    fireEvent.click(screen.getByRole('button', { name: 'graph-zoom-in' }))
    fireEvent.click(screen.getByRole('button', { name: 'graph-zoom-out' }))

    expect(screen.getByText('best:true')).toBeInTheDocument()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'graph-popup-deep-dive' }))
      fireEvent.click(screen.getByRole('button', { name: 'graph-popup-chat' }))
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'graph-popup-close' }))
    })

    expect(harness.graph.handleGraphPopupClose).toHaveBeenCalled()
    expect(harness.graph.handleGraphNodeClick).toHaveBeenCalled()
    expect(harness.graphRef.resetCamera).toHaveBeenCalled()
    expect(harness.graphRef.zoomIn).toHaveBeenCalled()
    expect(harness.graphRef.zoomOut).toHaveBeenCalled()
    expect(harness.ai.generate).toHaveBeenCalled()
    expect(screen.queryByTestId('replay-timeline')).not.toBeInTheDocument()
  })

  it('applies mobile behavior and enforces sidebar exclusivity transitions', async () => {
    harness.setRoot('root-mobile', 'Mobile root', 5)
    harness.isMobile = true
    harness.ai.lastMeta = {
      qualityScore: 7.4,
      promptLabel: 'Mobile prompt',
      promptVariant: 'v-mobile',
      evalModel: 'provider/mobile-eval',
      confidence: 0.81,
      uncertainty: 0.14,
      strengths: [],
      weaknesses: [],
      costGuard: { isNearLimit: false, usedTokens: 0, maxTokensPerSession: 2000 },
    }
    harness.stash.isOpen = false
    harness.probe.isOpen = true

    const { rerender } = render(<App />)

    expect(screen.getByTestId('mock-mobile-header')).toBeInTheDocument()
    expect(screen.getByText(/Quality:/i)).toBeInTheDocument()
    expect(screen.queryByTestId('theme-toggle')).not.toBeInTheDocument()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'mobile-open-onboarding' }))
      fireEvent.click(screen.getByRole('button', { name: 'mobile-create-note' }))
      fireEvent.click(screen.getByRole('button', { name: 'mobile-minimize-all' }))
      fireEvent.click(screen.getByRole('button', { name: 'mobile-close-all' }))
    })

    await act(async () => {
      harness.stash.isOpen = true
      harness.probe.isOpen = true
      rerender(<App />)
    })

    await act(async () => {
      harness.stash.isOpen = true
      harness.probe.isOpen = false
      rerender(<App />)
    })

    await act(async () => {
      harness.stash.isOpen = true
      harness.probe.isOpen = true
      rerender(<App />)
    })

    expect(harness.probe.setIsOpen).toHaveBeenCalledWith(false)
    expect(harness.stash.setIsOpen).toHaveBeenCalledWith(false)
  })

  it('refreshes eval stats and auto-advances onboarding when not in test mode', async () => {
    vi.stubEnv('MODE', 'development')
    vi.useFakeTimers()

    harness.setRoot('root-prod', 'Prod-like root', 5)
    const onEnter = vi.fn()
    harness.onboarding.isOpen = true
    harness.onboarding.currentStep = 0
    harness.onboardingSteps = [
      {
        title: 'Auto step',
        body: 'auto',
        canProceed: () => true,
        autoAdvance: true,
        onEnter,
      },
    ]

    render(<App />)

    expect(harness.eval.refresh).toHaveBeenCalled()
    expect(onEnter).toHaveBeenCalled()

    await act(async () => {
      vi.advanceTimersByTime(650)
    })

    expect(harness.onboarding.next).toHaveBeenCalled()
  })

  it('covers compare fallbacks and stash reopen defaults on root-target tree view', async () => {
    harness.setRoot('root-fallback', 'Root fallback question', 6)
    harness.tree.activeId = null
    harness.probe.isOpen = true
    harness.probe.sidebarWidth = 444
    harness.ai.lastMeta = {
      qualityScore: null,
      promptLabel: 'Fallback prompt',
      promptVariant: 'v-fallback',
      evalModel: 'provider/fallback-model',
      confidence: null,
      uncertainty: null,
      strengths: [],
      weaknesses: [],
      costGuard: { isNearLimit: true },
    }
    harness.eval.stats = null
    harness.api.compareQuestionGenerations.mockResolvedValueOnce({
      question: 'Root fallback question',
      left: {
        questions: ['Left fallback branch'],
        meta: { promptLabel: 'Left fallback' },
      },
      right: {
        questions: ['Right fallback branch'],
        meta: { promptLabel: 'Right fallback' },
      },
      winner: 'left',
      reason: 'Fallback branch quality check.',
    } as any)

    render(<App />)

    expect(screen.getByTestId('theme-toggle')).toHaveTextContent('theme:444')
    expect(screen.getByTestId('view-mode-toggle')).toHaveTextContent('view:444')
    expect(screen.getByTestId('model-selector')).toHaveTextContent('model:444')
    expect(screen.getByText(/Token budget warning: 0\/0 tokens used\./i)).toBeInTheDocument()
    expect(screen.getByText(/Target: root node/i)).toBeInTheDocument()

    const modelSelect = screen.getByRole('combobox')
    fireEvent.change(modelSelect, { target: { value: 'right-model' } })
    fireEvent.change(modelSelect, { target: { value: '' } })

    fireEvent.click(screen.getByRole('button', { name: /Run Compare/i }))
    await screen.findByText(/Winner:/i)

    expect(harness.api.compareQuestionGenerations).toHaveBeenCalledWith(
      'Root fallback question',
      expect.objectContaining({ rightModel: 'left-model' })
    )
    expect(screen.getAllByText(/Score —/i).length).toBeGreaterThanOrEqual(2)

    fireEvent.click(screen.getByRole('button', { name: /Apply Left/i }))
    expect(harness.addChildQuestion).toHaveBeenCalledWith(
      'root-fallback',
      'Left fallback branch',
      expect.objectContaining({
        confidence: null,
        uncertainty: null,
      })
    )

    harness.api.compareQuestionGenerations.mockRejectedValueOnce('raw compare failure')
    fireEvent.click(screen.getByRole('button', { name: /Run Compare/i }))
    expect(await screen.findByText(/Compare error: Failed to compare generations/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'stash-open-note-untitled' }))
    fireEvent.click(screen.getByRole('button', { name: 'stash-open-explanation-minimal' }))
    fireEvent.click(screen.getByRole('button', { name: 'stash-open-highlight-minimal' }))
    fireEvent.click(screen.getByRole('button', { name: 'stash-open-chat-assistant' }))

    expect(screen.getByText('note::Untitled note content')).toBeInTheDocument()
    expect(screen.getByText('concept:Sparse explanation')).toBeInTheDocument()
    expect(screen.getByText('note:Highlight:Highlight without normalized metadata')).toBeInTheDocument()
    expect(screen.getByText('note:AI said::Assistant reply')).toBeInTheDocument()
  })

  it('handles onboarding out-of-range and blocks auto-advance when canProceed is false', async () => {
    vi.stubEnv('MODE', 'development')
    vi.useFakeTimers()

    harness.setRoot('root-onboarding', 'Onboarding root', 5)
    harness.onboarding.isOpen = true
    harness.onboarding.currentStep = 5
    harness.onboardingSteps = [
      {
        title: 'Guarded step',
        body: 'guarded',
        canProceed: () => false,
        autoAdvance: true,
        onEnter: vi.fn(),
      },
    ]

    const { rerender } = render(<App />)
    expect(screen.getByTestId('mock-onboarding-overlay')).toHaveTextContent('canProceed:true step:5/1')

    harness.onboarding.currentStep = 0
    rerender(<App />)
    expect(screen.getByTestId('mock-onboarding-overlay')).toHaveTextContent('canProceed:false step:0/1')

    await act(async () => {
      vi.advanceTimersByTime(700)
    })
    expect(harness.onboarding.next).not.toHaveBeenCalled()
  })

  it('keeps generating indicator on the newer node when an earlier generation settles first', async () => {
    const rootA = harness.setRoot('root-a', 'Root A', 5)
    const rootB = {
      id: 'root-b',
      text: 'Root B',
      parentId: null,
      childIds: [] as string[],
      meta: { qualityScore: 4, confidence: null, uncertainty: null, isExpanded: true },
    }
    harness.tree.nodes = {
      [rootA.id]: rootA,
      [rootB.id]: rootB,
    }
    harness.tree.rootId = rootA.id
    harness.tree.activeId = rootA.id

    const firstGeneration = deferred<{ questions: string[]; meta: any }>()
    const secondGeneration = deferred<{ questions: string[]; meta: any }>()
    harness.ai.generate
      .mockImplementationOnce(() => firstGeneration.promise)
      .mockImplementationOnce(() => secondGeneration.promise)

    const { rerender } = render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'tree-generate' }))
    expect(screen.getByTestId('tree-generating-node')).toHaveTextContent('root-a')

    harness.tree.rootId = rootB.id
    harness.tree.activeId = rootB.id
    rerender(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'tree-generate' }))
    expect(screen.getByTestId('tree-generating-node')).toHaveTextContent('root-b')

    await act(async () => {
      firstGeneration.resolve({
        questions: ['A branch'],
        meta: {
          qualityScore: 6.2,
          confidence: 0.6,
          uncertainty: 0.2,
          promptLabel: 'A',
        },
      })
      await Promise.resolve()
    })

    expect(screen.getByTestId('tree-generating-node')).toHaveTextContent('root-b')

    await act(async () => {
      secondGeneration.resolve({
        questions: ['B branch'],
        meta: {
          qualityScore: 7.1,
          confidence: 0.7,
          uncertainty: 0.1,
          promptLabel: 'B',
        },
      })
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(screen.getByTestId('tree-generating-node')).toHaveTextContent('')
    })
  })

  it('does not overwrite existing user concepts when extraction resolves later', async () => {
    harness.setRoot('root-concepts', 'Concept root', 4)

    const extractionDeferred = deferred<ExtractedConcept[]>()
    harness.conceptExtraction.extract.mockImplementationOnce(() => extractionDeferred.promise)

    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'tree-add-user-concept' }))

    await act(async () => {
      extractionDeferred.resolve([
        {
          id: 'from-extract',
          text: 'Extracted concept',
          normalizedName: 'extracted concept',
          category: 'abstract',
          startIndex: 0,
          endIndex: 16,
        },
      ])
      await Promise.resolve()
    })

    fireEvent.click(screen.getByRole('button', { name: 'tree-lock-in' }))

    await waitFor(() => {
      expect(screen.getByTestId('mock-chat-view')).toBeInTheDocument()
    })
    expect(screen.getByTestId('chat-concepts-count')).toHaveTextContent('1')
  })

  it('covers no-op mobile sidebar exclusivity branches when opposite sidebar is already closed', async () => {
    harness.setRoot('root-mobile-noop', 'Mobile no-op root', 5)
    harness.isMobile = true
    harness.stash.isOpen = false
    harness.probe.isOpen = false

    const { rerender } = render(<App />)

    await act(async () => {
      harness.stash.isOpen = true
      harness.probe.isOpen = false
      rerender(<App />)
    })

    await act(async () => {
      harness.stash.isOpen = false
      harness.probe.isOpen = false
      rerender(<App />)
    })

    await act(async () => {
      harness.stash.isOpen = false
      harness.probe.isOpen = true
      rerender(<App />)
    })

    expect(harness.probe.setIsOpen).not.toHaveBeenCalled()
    expect(harness.stash.setIsOpen).not.toHaveBeenCalled()
  })

  it('uses root fallback context for concept fetches and skips fetches when all contexts are empty', async () => {
    harness.setRoot('root-context', 'Root fallback context', 5)
    const { rerender } = render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'tree-concept-hover-no-context' }))
    fireEvent.click(screen.getByRole('button', { name: 'tree-concept-click-no-context' }))

    expect(harness.conceptExplanation.fetchExplanation).toHaveBeenCalledWith(
      'tree-popup',
      'tree popup',
      'Root fallback context',
      'left-model'
    )

    const callsBefore = harness.conceptExplanation.fetchExplanation.mock.calls.length
    harness.tree.nodes['root-context'] = {
      ...harness.tree.nodes['root-context'],
      text: '',
    }
    rerender(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'tree-concept-hover-no-context' }))
    fireEvent.click(screen.getByRole('button', { name: 'tree-concept-click-no-context' }))

    expect(harness.conceptExplanation.fetchExplanation).toHaveBeenCalledTimes(callsBefore)
  })

  it('deduplicates related concept popups and handles empty related-context fallback', async () => {
    harness.setRoot('root-empty-related', '', 5)
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'tree-open-popup' }))
    fireEvent.click(screen.getByRole('button', { name: 'concept-related-tree-popup' }))

    await waitFor(() => {
      expect(screen.getAllByTestId(/concept-popup-related_/)).toHaveLength(1)
    })

    const callsBefore = harness.conceptExplanation.fetchExplanation.mock.calls.length
    fireEvent.click(screen.getByRole('button', { name: 'concept-related-tree-popup' }))

    await waitFor(() => {
      expect(screen.getAllByTestId(/concept-popup-related_/)).toHaveLength(1)
    })

    expect(harness.conceptExplanation.fetchExplanation).toHaveBeenCalledTimes(callsBefore)
  })

  it('opens related popups from chat-mode popups and uses chat source positioning', async () => {
    harness.setRoot('root-chat-related', 'Chat related root', 6)
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'tree-lock-in' }))
    await waitFor(() => {
      expect(screen.getByTestId('mock-chat-view')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'chat-open-popup' }))
    fireEvent.click(screen.getByRole('button', { name: 'concept-related-chat-concept' }))

    await waitFor(() => {
      expect(screen.getAllByTestId(/concept-popup-related_/).length).toBeGreaterThanOrEqual(1)
    })

    expect(harness.conceptExplanation.fetchExplanation).toHaveBeenCalledWith(
      expect.stringMatching(/^related_/),
      'related term',
      'Chat related root',
      'left-model'
    )
  })

  it('executes map fallbacks when updating/minimizing notes and reopened explanations', async () => {
    harness.setRoot('root-map-fallbacks', 'Map fallbacks root', 6)
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: /create new note/i }))
    fireEvent.click(screen.getByRole('button', { name: /create new note/i }))

    const updateButtons = screen.getAllByRole('button', { name: /note-update-/ })
    const minimizeButtons = screen.getAllByRole('button', { name: /note-minimize-/ })
    fireEvent.click(updateButtons[0])
    fireEvent.click(minimizeButtons[0])

    fireEvent.click(screen.getByRole('button', { name: 'tree-remove-missing-concept' }))

    fireEvent.click(screen.getByRole('button', { name: 'stash-open-explanation' }))
    fireEvent.click(screen.getByRole('button', { name: 'stash-open-explanation-minimal' }))

    const reopenedPopups = screen.getAllByTestId(/concept-popup-reopened-/)
    expect(reopenedPopups).toHaveLength(2)

    const firstPopupId = reopenedPopups[0].getAttribute('data-testid')!.replace('concept-popup-', '')
    fireEvent.click(screen.getByRole('button', { name: `concept-minimize-${firstPopupId}` }))

    fireEvent.click(screen.getByRole('button', { name: 'tree-open-popup' }))
    fireEvent.click(screen.getByRole('button', { name: 'concept-related-tree-popup' }))

    await waitFor(() => {
      expect(screen.getAllByTestId(/concept-popup-/).length).toBeGreaterThanOrEqual(3)
    })

    fireEvent.click(screen.getByRole('button', { name: 'concept-minimize-tree-popup' }))
  })

  it('covers graph offsets for desktop sidebars and mobile zero-offset mode', async () => {
    harness.setRoot('root-graph-offsets', 'Graph offsets root', 7)
    harness.viewMode.isGraphView = true
    harness.stash.isOpen = true
    harness.stash.sidebarWidth = 412
    harness.probe.isOpen = true
    harness.probe.sidebarWidth = 436

    const { rerender } = render(<App />)

    await waitFor(() => {
      expect(screen.getByTestId('mock-graph-view')).toBeInTheDocument()
    })
    expect(screen.getByText('leftOffset:412')).toBeInTheDocument()
    expect(screen.getByText('graph-right:436')).toBeInTheDocument()

    harness.isMobile = true
    rerender(<App />)

    await waitFor(() => {
      expect(screen.getByText('leftOffset:0')).toBeInTheDocument()
    })
    expect(screen.getByText('graph-right:0')).toBeInTheDocument()
  })

  it('renders welcome-mode mobile spacing styles', () => {
    harness.isMobile = true
    render(<App />)

    const submitButton = screen.getByRole('button', { name: 'mock-submit-root' })
    const welcomeContainer = submitButton.parentElement as HTMLElement
    expect(welcomeContainer.style.justifyContent).toBe('flex-start')
    expect(welcomeContainer.style.gap).toBe('var(--space-12)')
    expect(welcomeContainer.style.paddingTop).toBe('var(--space-12)')
  })

  it('renders mobile compare metadata fallbacks and mobile compare layout styles', async () => {
    harness.setRoot('root-mobile-compare', 'Mobile compare root', 6)
    harness.isMobile = true
    harness.ai.lastMeta = {
      qualityScore: null,
      promptLabel: 'Mobile compare prompt',
      promptVariant: 'v-mobile',
      evalModel: 'provider/mobile-compare',
      confidence: null,
      uncertainty: null,
      strengths: [],
      weaknesses: [],
      costGuard: { isNearLimit: false, usedTokens: 0, maxTokensPerSession: 1000 },
    }

    render(<App />)

    expect(screen.getByText(/Quality: —\/10/i)).toBeInTheDocument()
    expect(screen.getByText(/Conf: — · Unc: —/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Run Compare/i }))
    await screen.findByText(/Winner:/i)

    const winnerRow = screen.getByText(/Winner:/i).closest('div') as HTMLElement
    const compareGrid = winnerRow.parentElement as HTMLElement
    expect(winnerRow.style.gridColumn).toBe('auto')
    expect(compareGrid.style.gridTemplateColumns).toBe('1fr')
  })

  it('passes an empty concept list to chat when no concepts exist for the node', async () => {
    harness.setRoot('root-no-concepts', 'No concepts root', 5)
    harness.conceptExtraction.extract.mockResolvedValue([])

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'tree-lock-in' }))

    await waitFor(() => {
      expect(screen.getByTestId('mock-chat-view')).toBeInTheDocument()
    })
    expect(screen.getByTestId('chat-concepts-count')).toHaveTextContent('0')
  })

  it('keeps chat state stable when lock-in is triggered repeatedly for the same graph node', async () => {
    const root = harness.setRoot('root-lock-repeat', 'Repeat lock root', 6)
    harness.viewMode.isGraphView = true
    harness.graph.graphPopupNode = { id: root.id, label: 'Graph popup node' }

    const { rerender } = render(<App />)
    await waitFor(() => {
      expect(screen.getByTestId('mock-graph-view')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'graph-popup-chat' }))
    fireEvent.click(screen.getByRole('button', { name: 'graph-popup-chat' }))

    harness.viewMode.isGraphView = false
    rerender(<App />)

    await waitFor(() => {
      expect(screen.getByTestId('mock-chat-view')).toBeInTheDocument()
    })
    expect(screen.getByText('chat-question:Graph chat question')).toBeInTheDocument()
  })

  it('ignores unsupported stash item types without opening any popup', () => {
    harness.setRoot('root-unknown-stash', 'Unknown stash root', 5)
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'stash-open-unknown' }))

    expect(screen.queryByTestId(/note-popup-/)).not.toBeInTheDocument()
    expect(screen.queryByTestId(/concept-popup-/)).not.toBeInTheDocument()
  })
})
