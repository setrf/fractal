/**
 * @fileoverview Root application component for Fractal.
 * 
 * The App component manages the top-level application state and layout:
 * 
 * - When no root question exists: Shows the welcome view with QuestionInput
 * - When a root question exists: Shows the QuestionTree visualization
 * - When a question is "locked in": Shows the ChatView for deep exploration
 * 
 * The component acts as the orchestrator, connecting the useQuestionTree
 * hook to the UI components. It also integrates AI question generation
 * via W&B Weave and Inference.
 */

import { useState, useCallback, useEffect, useRef, useMemo, lazy, Suspense } from 'react'
import { ThemeToggle } from './components/ThemeToggle'
import { ViewModeToggle } from './components/ViewModeToggle'
import { ModelSelector } from './components/ModelSelector'
import { QuestionInput } from './components/QuestionInput'
import { QuestionTree } from './components/QuestionTree'
import { ChatView } from './components/ChatView'
import { StashSidebar } from './components/StashSidebar'
import { ProbeSidebar } from './components/ProbeSidebar'
import { NotePopup } from './components/NotePopup'
import { ConceptPopup } from './components/ConceptPopup'
import { MobileHeader } from './components/MobileHeader/MobileHeader'
import { EvalPanel } from './components/EvalPanel'
import { ReplayTimeline, type ReplayEvent } from './components/ReplayTimeline'
import type { GraphViewHandle } from './components/GraphView'
import { GraphControls } from './components/GraphControls'
import { GraphNodePopup } from './components/GraphNodePopup'
import { OnboardingOverlay } from './components/Onboarding'
import type { ConceptExplanation } from './types/concept'
import { StashProvider, useStashContext } from './context/StashContext'
import { ProbeProvider, useProbeContext } from './context/ProbeContext'
import { GraphProvider } from './context/GraphContext'
import { ViewModeProvider, useViewModeContext } from './context/ViewModeContext'
import { ModelProvider, useModelContext } from './context/ModelContext'
import { useQuestionTree } from './hooks/useQuestionTree'
import { useAIQuestions } from './hooks/useAIQuestions'
import { useEvalStats } from './hooks/useEvalStats'
import { useConceptExtraction } from './hooks/useConceptExtraction'
import { useConceptExplanation } from './hooks/useConceptExplanation'
import { useOnboarding } from './hooks/useOnboarding'
import { useOnboardingSteps } from './hooks/useOnboardingSteps'
import { useGraphInteractions } from './hooks/useGraphInteractions'
import { useIsMobile } from './hooks/useIsMobile'
import { compareQuestionGenerations, sendChatMessage, type ChatMessage, type ExtractedConcept } from './api'
import type { StashItem as StashItemData } from './types/stash'
import type { PopupPosition } from './components/ConceptPopup'
import { DEFAULT_POPUP_WIDTH, DEFAULT_POPUP_HEIGHT, findNonOverlappingPosition } from './components/ConceptPopup'

/**
 * View type for the application.
 */
type AppView = 'welcome' | 'tree' | 'chat'

/**
 * State for an open concept popup.
 */
interface OpenPopup {
  concept: ExtractedConcept
  position: PopupPosition
  isMinimized: boolean
  /** Source view where the popup was opened */
  sourceView: 'tree' | 'chat'
}

/**
 * State for the chat view.
 */
interface ChatState {
  nodeId: string
  question: string
}

/**
 * State for a canvas note popup.
 */
interface CanvasNote {
  id: string
  x: number
  y: number
  title: string
  content: string
  isMinimized: boolean
  /** Original stash item type (if reopened from stash) */
  sourceType?: 'note' | 'explanation' | 'question' | 'highlight' | 'chat-message'
}

const QUALITY_SCORE_MAX = 10
const QUALITY_SCORE_EPSILON = 0.001
const QUALITY_SCORE_IMPROVEMENT_RATIO = 0.1

const GraphView = lazy(async () => {
  const module = await import('./components/GraphView')
  return { default: module.GraphView }
})

function normalizeWeaveScore(score: number | null | undefined): number | null {
  if (typeof score !== 'number' || !Number.isFinite(score)) return null
  const normalized = Math.max(0, score)
  return normalized >= QUALITY_SCORE_MAX
    ? QUALITY_SCORE_MAX - QUALITY_SCORE_EPSILON
    : normalized
}

function computeChildQualityScore(parentScore: number, baseScore: number | null): number {
  const minHigher = parentScore + (QUALITY_SCORE_MAX - parentScore) * QUALITY_SCORE_IMPROVEMENT_RATIO
  if (baseScore === null) return minHigher
  return Math.max(baseScore, minHigher)
}

function computeBestBranchNodeIds(tree: { rootId: string | null; nodes: Record<string, { id: string; childIds: string[]; meta: { qualityScore: number | null } }> }): Set<string> {
  if (!tree.rootId || !tree.nodes[tree.rootId]) return new Set()

  let bestPath: string[] = [tree.rootId]
  let bestScore = Number.NEGATIVE_INFINITY

  const dfs = (nodeId: string, path: string[], cumulativeScore: number) => {
    const node = tree.nodes[nodeId]
    if (!node) return
    const nodeScore = typeof node.meta.qualityScore === 'number' ? node.meta.qualityScore : 0
    const nextScore = cumulativeScore + nodeScore
    const nextPath = [...path, nodeId]

    if (node.childIds.length === 0) {
      if (nextScore > bestScore) {
        bestScore = nextScore
        bestPath = nextPath
      }
      return
    }

    node.childIds.forEach((childId) => dfs(childId, nextPath, nextScore))
  }

  dfs(tree.rootId, [], 0)
  return new Set(bestPath)
}

/**
 * State for a reopened explanation popup from stash.
 */
interface ReopenedExplanation {
  id: string
  x: number
  y: number
  concept: ExtractedConcept
  explanation: ConceptExplanation
  isMinimized: boolean
}

/**
 * Inner application content component.
 * 
 * Renders either:
 * 1. Welcome view with centered input (no root question)
 * 2. Tree view with branching questions (has root question)
 * 3. Chat view for deep exploration of a specific question
 * 
 * The ThemeToggle is always visible in the top-right corner.
 * The StashSidebar is available in all views.
 */
function AppContent() {
  // Get stash state for sidebar layout and items for graph
  const {
    isOpen: stashOpen,
    sidebarWidth,
    items: stashItems,
    setIsOpen: setStashOpen,
  } = useStashContext()
  // Get probe state for sidebar layout and probes for graph
  const {
    isOpen: probeOpen,
    sidebarWidth: probeSidebarWidth,
    probes,
    activeProbe,
    setIsOpen: setProbeOpen,
  } = useProbeContext()
  // Initialize the question tree state and operations
  const {
    tree,
    rootNode,
    activeNode,
    addRootQuestion,
    addChildQuestion,
    setActiveNode,
    toggleNodeExpansion,
    updateNodeMeta,
    reset,
  } = useQuestionTree()

  const { selectedModel, models } = useModelContext()

  // Mobile detection
  const isMobile = useIsMobile()

  // Exclusive sidebar management for mobile
  const prevStashOpen = useRef(stashOpen)
  const prevProbeOpen = useRef(probeOpen)

  useEffect(() => {
    if (!isMobile) return

    // If stash JUST opened, close probe
    if (stashOpen && !prevStashOpen.current) {
      if (probeOpen) setProbeOpen(false)
    }
    // If probe JUST opened, close stash
    else if (probeOpen && !prevProbeOpen.current) {
      if (stashOpen) setStashOpen(false)
    }

    prevStashOpen.current = stashOpen
    prevProbeOpen.current = probeOpen
  }, [isMobile, stashOpen, probeOpen, setStashOpen, setProbeOpen])

  // AI question generation
  const { generate, isLoading: aiLoading, error: aiError, lastMeta } = useAIQuestions()
  const {
    stats: evalStats,
    isLoading: evalStatsLoading,
    error: evalStatsError,
    refresh: refreshEvalStats,
  } = useEvalStats()
  
  // Concept extraction and explanation
  const { extract: extractConcepts } = useConceptExtraction()
  
  const {
    explanation: conceptExplanation,
    explanations: allExplanations,
    loadingStates: explanationLoadingStates,
    isLoading: explanationLoading,
    error: explanationError,
    fetchExplanation,
    reset: resetExplanation,
  } = useConceptExplanation()

  const activeModel = selectedModel || undefined
  const extractConceptsWithModel = useCallback(
    (text: string) => extractConcepts(text, activeModel),
    [extractConcepts, activeModel]
  )
  const fetchExplanationWithModel = useCallback(
    (conceptId: string, conceptName: string, questionContext: string) =>
      fetchExplanation(conceptId, conceptName, questionContext, activeModel),
    [fetchExplanation, activeModel]
  )
  
  // Track which node is currently generating
  const [generatingNodeId, setGeneratingNodeId] = useState<string | null>(null)
  // Track latest generation request per node so stale responses are ignored.
  const generationRequestCounter = useRef(0)
  const latestGenerationRequestByNode = useRef<Map<string, number>>(new Map())
  
  // Track concepts per node (nodeId -> concepts)
  const [nodeConcepts, setNodeConcepts] = useState<Record<string, ExtractedConcept[]>>({})
  // Track latest concept extraction request per node to ignore stale responses.
  const conceptExtractionRequestCounter = useRef(0)
  const latestConceptExtractionByNode = useRef<Map<string, number>>(new Map())

  // View state for navigating between tree and chat
  const [chatState, setChatState] = useState<ChatState | null>(null)
  const [chatVisible, setChatVisible] = useState(false)
  
  // Canvas note popups
  const [canvasNotes, setCanvasNotes] = useState<CanvasNote[]>([])
  const noteIdCounter = useRef(0)
  
  // Reopened explanation popups from stash
  const [reopenedExplanations, setReopenedExplanations] = useState<ReopenedExplanation[]>([])
  
  // Global concept popups (from ChatView and QuestionTree)
  const [globalPopups, setGlobalPopups] = useState<OpenPopup[]>([])
  
  // Track which notes are minimized for stacking
  const minimizedNoteIds = canvasNotes.filter(n => n.isMinimized).map(n => n.id)
  const minimizedExplanationIds = reopenedExplanations.filter(e => e.isMinimized).map(e => e.id)
  const minimizedGlobalPopupIds = globalPopups.filter(p => p.isMinimized).map(p => p.concept.id)
  
  // Trigger counters for minimize all / close all (propagated to child components)
  const [minimizeAllTrigger, setMinimizeAllTrigger] = useState(0)
  const [closeAllTrigger, setCloseAllTrigger] = useState(0)

  // A/B compare mode state
  const [compareLoading, setCompareLoading] = useState(false)
  const [compareError, setCompareError] = useState<string | null>(null)
  const [compareResult, setCompareResult] = useState<Awaited<ReturnType<typeof compareQuestionGenerations>> | null>(null)
  const [compareRightModel, setCompareRightModel] = useState<string | null>(null)

  // Replay timeline state
  const [replayEvents, setReplayEvents] = useState<ReplayEvent[]>([])

  // View mode (traditional vs graph)
  const { isGraphView } = useViewModeContext()

  // Graph view ref for camera controls
  const graphRef = useRef<GraphViewHandle | null>(null)

  // Determine current view
  const currentView: AppView = !rootNode ? 'welcome' : chatVisible ? 'chat' : 'tree'

  const recordReplayEvent = useCallback((type: string, label: string, detail?: string) => {
    const event: ReplayEvent = {
      id: `replay_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      timestamp: Date.now(),
      type,
      label,
      detail,
    }
    setReplayEvents((prev) => [...prev.slice(-199), event])
  }, [])

  const bestBranchNodeIds = useMemo(() => computeBestBranchNodeIds(tree), [tree])

  const stashCount = stashItems.length
  const probeCount = probes.length
  const rootChildCount = rootNode?.childIds.length ?? 0
  const rootConceptCount = rootNode ? (nodeConcepts[rootNode.id]?.length ?? 0) : 0
  const hasPopup = globalPopups.length > 0
  const activeProbeSelectedCount = activeProbe?.selectedStashItemIds.length ?? 0
  const activeProbeMessageCount = activeProbe?.messages.length ?? 0

  const onboardingSteps = useOnboardingSteps({
    hasRootNode: Boolean(rootNode),
    rootChildCount,
    rootConceptCount,
    hasLastMeta: Boolean(lastMeta),
    hasPopup,
    stashCount,
    stashOpen,
    probeCount,
    activeProbeSelectedCount,
    activeProbeMessageCount,
    isGraphView,
    setStashOpen,
    setProbeOpen,
  })

  const onboarding = useOnboarding({
    totalSteps: onboardingSteps.length,
    autoStart: true,
    storageKey: 'fractal_onboarding_v1',
    version: 'v1',
  })
  const onboardingIsOpen = onboarding.isOpen
  const onboardingCurrentStep = onboarding.currentStep
  const onboardingNext = onboarding.next

  const activeOnboardingStep = onboardingSteps[onboardingCurrentStep] ?? null
  const canProceedOnboarding = activeOnboardingStep?.canProceed
    ? activeOnboardingStep.canProceed()
    : true
  const onboardingButtonLabel = onboarding.hasCompleted ? 'Restart Onboarding' : 'Start Onboarding'

  useEffect(() => {
    if (!onboardingIsOpen || !activeOnboardingStep) return
    activeOnboardingStep.onEnter?.()
  }, [onboardingIsOpen, onboardingCurrentStep, activeOnboardingStep])

  useEffect(() => {
    void refreshEvalStats()
  }, [refreshEvalStats])

  useEffect(() => {
    if (!onboardingIsOpen || !activeOnboardingStep?.autoAdvance) return
    if (!canProceedOnboarding) return
    const timer = setTimeout(() => onboardingNext(), 600)
    return () => clearTimeout(timer)
  }, [onboardingIsOpen, onboardingNext, activeOnboardingStep?.autoAdvance, canProceedOnboarding])
  
  const extractNodeConcepts = useCallback(async (nodeId: string, text: string) => {
    if (nodeConcepts[nodeId]) return

    const requestId = conceptExtractionRequestCounter.current + 1
    conceptExtractionRequestCounter.current = requestId
    latestConceptExtractionByNode.current.set(nodeId, requestId)

    const extracted = await extractConceptsWithModel(text)
    if (latestConceptExtractionByNode.current.get(nodeId) !== requestId) {
      return
    }
    if (extracted.length === 0) {
      return
    }

    setNodeConcepts(prev => {
      if (prev[nodeId]) return prev
      return { ...prev, [nodeId]: extracted }
    })
  }, [nodeConcepts, extractConceptsWithModel])

  // Extract concepts for root node when it changes.
  useEffect(() => {
    if (!rootNode) return
    void extractNodeConcepts(rootNode.id, rootNode.text)
  }, [rootNode, extractNodeConcepts])

  /**
   * Handles node selection - wraps setActiveNode to also trigger concept extraction.
   * When a node is selected, we automatically extract concepts if not already done.
   */
  const handleSelectNode = useCallback((nodeId: string) => {
    setActiveNode(nodeId)
    const node = tree.nodes[nodeId]
    if (node) {
      recordReplayEvent('navigate', 'Selected node', node.text)
    }
    
    // Auto-extract concepts for the selected node if not already done
    if (node && !nodeConcepts[nodeId]) {
      void extractNodeConcepts(nodeId, node.text)
    }
  }, [tree.nodes, nodeConcepts, extractNodeConcepts, setActiveNode, recordReplayEvent])

  /**
   * Generates AI suggestions for a node and adds them as children.
   * Uses W&B Inference via the backend server.
   */
  const handleGenerateAI = useCallback(async (parentId: string, question: string) => {
    const requestId = generationRequestCounter.current + 1
    generationRequestCounter.current = requestId
    latestGenerationRequestByNode.current.set(parentId, requestId)
    setGeneratingNodeId(parentId)
    recordReplayEvent('deep-dive', 'Started AI Deep dive', question)
    try {
      const { questions: suggestions, meta } = await generate(question, activeModel)
      if (latestGenerationRequestByNode.current.get(parentId) !== requestId) {
        return
      }
      const parent = tree.nodes[parentId]
      const normalizedParentScore = normalizeWeaveScore(parent?.meta.qualityScore)
      const parentScore = normalizedParentScore ?? 0
      if (parent && parent.meta.qualityScore !== parentScore) {
        updateNodeMeta(parentId, { qualityScore: parentScore })
      }
      const baseScore = normalizeWeaveScore(meta?.qualityScore)
      const childScore = computeChildQualityScore(parentScore, baseScore)
      const confidence = typeof meta?.confidence === 'number' ? meta.confidence : null
      const uncertainty = typeof meta?.uncertainty === 'number' ? meta.uncertainty : null
      // Add each generated question as a child
      for (const suggestion of suggestions) {
        addChildQuestion(parentId, suggestion, {
          qualityScore: childScore,
          confidence,
          uncertainty,
        })
      }
      recordReplayEvent(
        'deep-dive',
        `Generated ${suggestions.length} questions`,
        `Score ${meta?.qualityScore?.toFixed(2) ?? 'N/A'} · ${meta?.promptLabel ?? 'Unknown prompt'}`
      )
      void refreshEvalStats()
    } finally {
      if (latestGenerationRequestByNode.current.get(parentId) === requestId) {
        latestGenerationRequestByNode.current.delete(parentId)
        setGeneratingNodeId(current => (current === parentId ? null : current))
      }
    }
  }, [generate, addChildQuestion, tree.nodes, updateNodeMeta, activeModel, recordReplayEvent, refreshEvalStats])

  const handleRunCompare = useCallback(async () => {
    const targetNode = activeNode ?? rootNode
    if (!targetNode) return
    setCompareLoading(true)
    setCompareError(null)
    recordReplayEvent('compare', 'Started A/B compare', targetNode.text)
    try {
      const result = await compareQuestionGenerations(targetNode.text, {
        leftModel: activeModel,
        rightModel: compareRightModel || activeModel,
      })
      setCompareResult(result)
      recordReplayEvent('compare', `Compare winner: ${result.winner}`, result.reason)
      await refreshEvalStats()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to compare generations'
      setCompareError(message)
    } finally {
      setCompareLoading(false)
    }
  }, [activeNode, rootNode, activeModel, compareRightModel, recordReplayEvent, refreshEvalStats])

  const handleAddChild = useCallback((parentId: string, question: string) => {
    addChildQuestion(parentId, question)
    recordReplayEvent('customize', 'Added custom branch question', question)
  }, [addChildQuestion, recordReplayEvent])

  const handleApplyCompareResult = useCallback((side: 'left' | 'right') => {
    if (!compareResult) return
    const targetNode = activeNode ?? rootNode
    if (!targetNode) return
    const selected = side === 'left' ? compareResult.left : compareResult.right
    const parentScore = normalizeWeaveScore(tree.nodes[targetNode.id]?.meta.qualityScore) ?? 0
    const selectedScore = normalizeWeaveScore(selected.meta?.qualityScore ?? null)
    const childScore = computeChildQualityScore(parentScore, selectedScore)
    const confidence = typeof selected.meta?.confidence === 'number' ? selected.meta.confidence : null
    const uncertainty = typeof selected.meta?.uncertainty === 'number' ? selected.meta.uncertainty : null

    selected.questions.forEach((question) => {
      addChildQuestion(targetNode.id, question, {
        qualityScore: childScore,
        confidence,
        uncertainty,
      })
    })
    recordReplayEvent('compare', `Applied ${side.toUpperCase()} branch`, `${selected.questions.length} questions`)
  }, [compareResult, activeNode, rootNode, tree.nodes, addChildQuestion, recordReplayEvent])

  /**
   * Handles submission of the initial question.
   * Creates the root node and immediately triggers Deep dive.
   */
  const handleQuestionSubmit = useCallback((question: string) => {
    const nodeId = addRootQuestion(question)
    recordReplayEvent('seed', 'Submitted seed question', question)
    // Immediately trigger Deep dive to generate sub-questions
    handleGenerateAI(nodeId, question)
  }, [addRootQuestion, handleGenerateAI, recordReplayEvent])

  /**
   * Handles "lock in" on a question to open the chat view.
   */
  const handleLockIn = useCallback((nodeId: string, question: string) => {
    // If this is a different question than the current chat, reset chat state
    if (chatState?.nodeId !== nodeId) {
      setChatState({ nodeId, question })
    }
    setChatVisible(true)
    recordReplayEvent('chat', 'Opened deep-dive chat', question)
  }, [chatState?.nodeId, recordReplayEvent])

  /**
   * Returns from chat view to tree view.
   * Keeps chatState so we can return to the same conversation.
   */
  const handleBackToTree = useCallback(() => {
    setChatVisible(false)
  }, [])

  /**
   * Sends a chat message and returns the response.
   */
  const handleSendChatMessage = useCallback(async (messages: ChatMessage[]): Promise<string> => {
    if (!chatState) throw new Error('No chat state')
    const lastUserMessage = [...messages].reverse().find((message) => message.role === 'user')
    recordReplayEvent('chat', 'Sent chat message', lastUserMessage?.content.slice(0, 140))
    return sendChatMessage(chatState.question, messages, activeModel)
  }, [chatState, activeModel, recordReplayEvent])

  /**
   * Handles concept hover - fetches explanation.
   */
  const handleConceptHover = useCallback((concept: ExtractedConcept, questionContext?: string) => {
    const context = questionContext || chatState?.question || rootNode?.text || ''
    if (context) {
      fetchExplanationWithModel(concept.id, concept.normalizedName, context)
    }
  }, [chatState, rootNode, fetchExplanationWithModel])

  /**
   * Handles concept click - same as hover for now, but could trigger sticky.
   */
  const handleConceptClick = useCallback((concept: ExtractedConcept, questionContext?: string) => {
    const context = questionContext || chatState?.question || rootNode?.text || ''
    if (context) {
      fetchExplanationWithModel(concept.id, concept.normalizedName, context)
    }
  }, [chatState, rootNode, fetchExplanationWithModel])

  /**
   * Handles user-created concept highlights.
   */
  const handleAddUserConcept = useCallback((nodeId: string, concept: ExtractedConcept) => {
    setNodeConcepts(prev => {
      const existing = prev[nodeId] || []
      // Add the new concept and sort by position
      const updated = [...existing, concept].sort((a, b) => a.startIndex - b.startIndex)
      return { ...prev, [nodeId]: updated }
    })
  }, [])

  /**
   * Handles removing a concept highlight.
   */
  const handleRemoveConcept = useCallback((nodeId: string, conceptId: string) => {
    setNodeConcepts(prev => {
      const existing = prev[nodeId] || []
      const updated = existing.filter(c => c.id !== conceptId)
      return { ...prev, [nodeId]: updated }
    })
  }, [])

  /**
   * Handles full reset - clears tree and all associated state.
   */
  const handleReset = useCallback(() => {
    reset()
    setNodeConcepts({})
    latestConceptExtractionByNode.current.clear()
    conceptExtractionRequestCounter.current = 0
    setChatState(null)
    resetExplanation()
    setCanvasNotes([])
    setReopenedExplanations([])
    setGlobalPopups([])
    setCompareResult(null)
    setCompareError(null)
    setReplayEvents([])
    void refreshEvalStats()
    recordReplayEvent('reset', 'Reset exploration')
  }, [reset, resetExplanation, refreshEvalStats, recordReplayEvent])

  /**
   * Opens a global popup for a concept.
   * Used by ChatView and QuestionTree to open popups that persist across views.
   */
  const handleOpenPopup = useCallback((concept: ExtractedConcept, position: { x: number; y: number }) => {
    // Check if this concept already has an open popup
    const existingPopup = globalPopups.find(p => 
      p.concept.id === concept.id || p.concept.normalizedName === concept.normalizedName
    )
    if (existingPopup) return
    
    // Find non-overlapping position
    const existingPositions = globalPopups.map(p => ({
      x: p.position.x,
      y: p.position.y,
      width: DEFAULT_POPUP_WIDTH,
      height: DEFAULT_POPUP_HEIGHT,
      isMinimized: p.isMinimized,
    }))
    const newPosition = findNonOverlappingPosition(position.x, position.y, existingPositions)
    
    // Add new popup
    const newPopup: OpenPopup = {
      concept,
      position: newPosition,
      isMinimized: false,
      sourceView: chatVisible ? 'chat' : 'tree',
    }
    setGlobalPopups(prev => [...prev, newPopup])
  }, [globalPopups, chatVisible])

  /**
   * Closes a global popup by concept ID.
   */
  const handleClosePopup = useCallback((conceptId: string) => {
    setGlobalPopups(prev => prev.filter(p => p.concept.id !== conceptId))
  }, [])

  /**
   * Handles minimize state change for a global popup.
   */
  const handlePopupMinimizeChange = useCallback((conceptId: string, isMinimized: boolean) => {
    setGlobalPopups(prev => prev.map(p =>
      p.concept.id === conceptId ? { ...p, isMinimized } : p
    ))
  }, [])

  /**
   * Opens a popup for a related concept.
   */
  const handleRelatedConceptClick = useCallback((conceptName: string) => {
    // Check if this concept already has an open popup
    const existingPopup = globalPopups.find(p => 
      p.concept.normalizedName === conceptName.toLowerCase()
    )
    if (existingPopup) return
    
    // Create a synthetic concept for the related item
    const syntheticConcept: ExtractedConcept = {
      id: `related_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      text: conceptName,
      normalizedName: conceptName.toLowerCase(),
      category: 'abstract',
      startIndex: -1,
      endIndex: -1,
    }
    
    // Find non-overlapping position near center
    const existingPositions = globalPopups.map(p => ({
      x: p.position.x,
      y: p.position.y,
      width: DEFAULT_POPUP_WIDTH,
      height: DEFAULT_POPUP_HEIGHT,
      isMinimized: p.isMinimized,
    }))
    const position = findNonOverlappingPosition(
      window.innerWidth / 2 - DEFAULT_POPUP_WIDTH / 2,
      window.innerHeight / 3,
      existingPositions
    )
    
    // Add new popup
    const newPopup: OpenPopup = {
      concept: syntheticConcept,
      position,
      isMinimized: false,
      sourceView: chatVisible ? 'chat' : 'tree',
    }
    setGlobalPopups(prev => [...prev, newPopup])
    
    // Trigger explanation fetch
    const questionContext = chatState?.question || rootNode?.text || ''
    if (questionContext) {
      fetchExplanationWithModel(syntheticConcept.id, syntheticConcept.normalizedName, questionContext)
    }
  }, [globalPopups, chatVisible, chatState, rootNode, fetchExplanationWithModel])

  /**
   * Creates a new note popup in a centered position.
   */
  const handleCreateNote = useCallback(() => {
    const id = `note-${Date.now()}-${noteIdCounter.current++}`
    const x = Math.max(100, (window.innerWidth - 300) / 2)
    const y = Math.max(100, (window.innerHeight - 300) / 3)
    const newNote: CanvasNote = {
      id,
      x,
      y,
      title: '',
      content: '',
      isMinimized: false,
      sourceType: 'note',
    }
    
    setCanvasNotes(prev => [...prev, newNote])
    recordReplayEvent('note', 'Created canvas note')
  }, [recordReplayEvent])

  /**
   * Updates a note's content.
   */
  const handleNoteUpdate = useCallback((id: string, title: string, content: string) => {
    setCanvasNotes(prev => prev.map(note => 
      note.id === id ? { ...note, title, content } : note
    ))
  }, [])

  /**
   * Closes a note popup.
   */
  const handleNoteClose = useCallback((id: string) => {
    setCanvasNotes(prev => prev.filter(note => note.id !== id))
  }, [])

  /**
   * Handles minimize state change for a note.
   */
  const handleNoteMinimizeChange = useCallback((id: string, isMinimized: boolean) => {
    setCanvasNotes(prev => prev.map(note =>
      note.id === id ? { ...note, isMinimized } : note
    ))
  }, [])

  /**
   * Closes a reopened explanation popup.
   */
  const handleReopenedExplanationClose = useCallback((id: string) => {
    setReopenedExplanations(prev => prev.filter(e => e.id !== id))
  }, [])

  /**
   * Handles minimize state change for a reopened explanation.
   */
  const handleReopenedExplanationMinimizeChange = useCallback((conceptId: string, isMinimized: boolean) => {
    // Find by concept id (which we set to the popup id)
    setReopenedExplanations(prev => prev.map(e =>
      e.concept.id === conceptId ? { ...e, isMinimized } : e
    ))
  }, [])

  /**
   * Handles clicking a stash item to reopen it as a popup.
   */
  const handleStashItemClick = useCallback((item: StashItemData) => {
    recordReplayEvent('stash', 'Opened stash artifact', item.content.slice(0, 120))
    // Calculate a centered position for the new popup
    const x = Math.max(100, (window.innerWidth - 300) / 2)
    const y = Math.max(100, (window.innerHeight - 300) / 3)
    const id = `popup-${Date.now()}-${noteIdCounter.current++}`
    
    if (item.type === 'note') {
      // Reopen as editable NotePopup
      const newNote: CanvasNote = {
        id,
        x,
        y,
        title: item.metadata.title || '',
        content: item.content,
        isMinimized: false,
        sourceType: 'note',
      }
      setCanvasNotes(prev => [...prev, newNote])
    } else if (item.type === 'explanation') {
      // Reopen as full ConceptPopup with all features
      const concept: ExtractedConcept = {
        id: `reopened-${id}`,
        text: item.content,
        normalizedName: item.metadata.normalizedName || item.content,
        category: item.metadata.conceptCategory || 'abstract',
        startIndex: 0,
        endIndex: item.content.length,
      }
      const explanation: ConceptExplanation = {
        conceptId: concept.id,
        normalizedName: concept.normalizedName,
        summary: item.metadata.summary || '',
        context: item.metadata.context || '',
        relatedConcepts: item.metadata.relatedConcepts || [],
      }
      const reopened: ReopenedExplanation = {
        id,
        x,
        y,
        concept,
        explanation,
        isMinimized: false,
      }
      setReopenedExplanations(prev => [...prev, reopened])
    } else if (item.type === 'question') {
      // Reopen as read-only viewer
      const newNote: CanvasNote = {
        id,
        x,
        y,
        title: 'Question',
        content: item.content,
        isMinimized: false,
        sourceType: 'question',
      }
      setCanvasNotes(prev => [...prev, newNote])
    } else if (item.type === 'highlight') {
      // Reopen as read-only viewer
      const newNote: CanvasNote = {
        id,
        x,
        y,
        title: item.metadata.normalizedName || 'Highlight',
        content: item.content,
        isMinimized: false,
        sourceType: 'highlight',
      }
      setCanvasNotes(prev => [...prev, newNote])
    } else if (item.type === 'chat-message') {
      // Reopen as read-only viewer
      const role = item.metadata.role === 'assistant' ? 'AI' : 'You'
      const newNote: CanvasNote = {
        id,
        x,
        y,
        title: `${role} said:`,
        content: item.content,
        isMinimized: false,
        sourceType: 'chat-message',
      }
      setCanvasNotes(prev => [...prev, newNote])
    }
  }, [recordReplayEvent])

  /**
   * Minimizes all open popups (canvas notes, explanations, global popups, and child component popups).
   */
  const handleMinimizeAll = useCallback(() => {
    // Minimize all canvas notes
    setCanvasNotes(prev => prev.map(note => ({ ...note, isMinimized: true })))
    // Minimize all reopened explanations
    setReopenedExplanations(prev => prev.map(exp => ({ ...exp, isMinimized: true })))
    // Minimize all global popups
    setGlobalPopups(prev => prev.map(p => ({ ...p, isMinimized: true })))
    // Trigger child components to minimize their popups
    setMinimizeAllTrigger(prev => prev + 1)
  }, [])

  /**
   * Closes all open popups (canvas notes, explanations, global popups, and child component popups).
   */
  const handleCloseAll = useCallback(() => {
    // Close all canvas notes
    setCanvasNotes([])
    // Close all reopened explanations
    setReopenedExplanations([])
    // Close all global popups
    setGlobalPopups([])
    // Trigger child components to close their popups
    setCloseAllTrigger(prev => prev + 1)
  }, [])

  const {
    graphPopupNode,
    graphPopupPosition,
    handleGraphNodeClick,
    handleGraphPopupClose,
    handleGraphDeepDive,
    handleGraphChat,
  } = useGraphInteractions({
    onDeepDive: handleGenerateAI,
    onChat: handleLockIn,
  })

  // Build layout classes for both sidebars
  const layoutClasses = [
    'app-layout',
    stashOpen ? 'stash-open' : 'stash-collapsed',
    probeOpen ? 'probe-open' : 'probe-collapsed',
    isGraphView ? 'graph-view' : 'traditional-view',
  ].join(' ')

  return (
    <div className={layoutClasses}>
      {/* Mobile header - consolidated controls for small screens */}
      {isMobile && (
        <MobileHeader
          onOpenOnboarding={onboarding.restart}
          onCreateNote={handleCreateNote}
          onMinimizeAll={handleMinimizeAll}
          onCloseAll={handleCloseAll}
        />
      )}

      {/* Stash sidebar - always available (left side) */}
      <StashSidebar onItemClick={handleStashItemClick} />
      
      {/* Main content area */}
      <div className="main-content" style={isMobile ? { paddingTop: '56px' } : undefined}>
        {/* Desktop toggles - hidden on mobile in favor of MobileHeader */}
        {!isMobile && (
          <>
            {/* Theme toggle - always visible in all views, shifts with probe sidebar */}
            <ThemeToggle rightOffset={probeOpen ? probeSidebarWidth : 48} />
            
            {/* View mode toggle - always visible in all views, shifts with probe sidebar */}
            <ViewModeToggle rightOffset={probeOpen ? probeSidebarWidth : 48} />

            {/* Model selector - always visible in all views, shifts with probe sidebar */}
            <ModelSelector rightOffset={probeOpen ? probeSidebarWidth : 48} />
            
            {/* Action buttons - fixed in upper left after stash (visible in all views) */}
            <div
              style={{
                position: 'fixed',
                top: 'var(--space-3)',
                left: stashOpen ? `calc(${sidebarWidth}px + var(--space-3))` : 'calc(48px + var(--space-3))',
                display: 'flex',
                gap: 'var(--space-2)',
                zIndex: 99,
                transition: 'left var(--transition-normal)',
              }}
            >
              <button
                onClick={handleCreateNote}
                style={{
                  padding: 'var(--space-2) var(--space-3)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--text-sm)',
                  background: 'var(--bg-primary)',
                  border: 'var(--border-width) solid var(--border-primary)',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'border-color 0.2s, color 0.2s',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.borderColor = 'var(--text-primary)'
                  e.currentTarget.style.color = 'var(--text-primary)'
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-primary)'
                  e.currentTarget.style.color = 'var(--text-secondary)'
                }}
                title="Create a new note"
                aria-label="Create new note"
              >
                + Note
              </button>
              <button
                onClick={handleMinimizeAll}
                style={{
                  padding: 'var(--space-2) var(--space-3)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--text-sm)',
                  background: 'var(--bg-primary)',
                  border: 'var(--border-width) solid var(--border-primary)',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'border-color 0.2s, color 0.2s',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.borderColor = 'var(--text-primary)'
                  e.currentTarget.style.color = 'var(--text-primary)'
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-primary)'
                  e.currentTarget.style.color = 'var(--text-secondary)'
                }}
                title="Minimize all popups"
                aria-label="Minimize all popups"
              >
                ⌄ Minimize All
              </button>
              <button
                onClick={handleCloseAll}
                style={{
                  padding: 'var(--space-2) var(--space-3)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--text-sm)',
                  background: 'var(--bg-primary)',
                  border: 'var(--border-width) solid var(--border-primary)',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'border-color 0.2s, color 0.2s',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.borderColor = 'var(--text-primary)'
                  e.currentTarget.style.color = 'var(--text-primary)'
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-primary)'
                  e.currentTarget.style.color = 'var(--text-secondary)'
                }}
                title="Close all popups"
                aria-label="Close all popups"
              >
                × Close All
              </button>
              <button
                onClick={onboarding.restart}
                style={{
                  padding: 'var(--space-2) var(--space-3)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--text-sm)',
                  background: 'var(--bg-primary)',
                  border: 'var(--border-width) solid var(--border-primary)',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'border-color 0.2s, color 0.2s',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.borderColor = 'var(--text-primary)'
                  e.currentTarget.style.color = 'var(--text-primary)'
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-primary)'
                  e.currentTarget.style.color = 'var(--text-secondary)'
                }}
                title="Start the onboarding tour"
                aria-label="Start onboarding tour"
              >
                {onboardingButtonLabel}
              </button>
            </div>
          </>
        )}
        
        {/* ============================================
         * GRAPH VIEW
         * 3D knowledge graph visualization of all entities.
         * Shown when view mode is 'graph'.
         * ============================================ */}
        {isGraphView && (
          <GraphProvider
            tree={tree}
            nodeConcepts={nodeConcepts}
            stashItems={stashItems}
            probes={probes}
          >
            <Suspense
              fallback={
                <div
                  style={{
                    minHeight: isMobile ? 'calc(100vh - 56px)' : '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  Loading graph...
                </div>
              }
            >
              <GraphView
                ref={graphRef}
                onNodeClick={handleGraphNodeClick}
                leftOffset={isMobile ? 0 : (stashOpen ? sidebarWidth : 48)}
              />
            </Suspense>
            <GraphControls
              onResetCamera={() => graphRef.current?.resetCamera?.()}
              onZoomIn={() => graphRef.current?.zoomIn?.()}
              onZoomOut={() => graphRef.current?.zoomOut?.()}
              rightOffset={isMobile ? 0 : (probeOpen ? probeSidebarWidth : 48)}
            />
            {graphPopupNode && (
              <GraphNodePopup
                node={graphPopupNode}
                position={graphPopupPosition}
                onClose={handleGraphPopupClose}
                onDeepDive={handleGraphDeepDive}
                onChat={handleGraphChat}
                isBestBranch={bestBranchNodeIds.has(graphPopupNode.id)}
              />
            )}
          </GraphProvider>
        )}
        
        {/* ============================================
         * CHAT VIEW
         * Shown when a question is "locked in" for deep exploration.
         * Kept mounted (but hidden) to preserve popup state when switching views.
         * ============================================ */}
        {chatState && !isGraphView && (
          <div 
            key={chatState.nodeId}
            style={{ display: currentView === 'chat' ? 'block' : 'none' }}
          >
            <ChatView
              question={chatState.question}
              onBack={handleBackToTree}
              onSendMessage={handleSendChatMessage}
              concepts={nodeConcepts[chatState.nodeId] || []}
              conceptExplanations={allExplanations}
              conceptLoadingStates={explanationLoadingStates}
              conceptExplanation={conceptExplanation}
              isConceptLoading={explanationLoading}
              conceptError={explanationError}
              onConceptHover={handleConceptHover}
              onConceptClick={handleConceptClick}
              extractConcepts={extractConceptsWithModel}
              minimizeAllTrigger={minimizeAllTrigger}
              closeAllTrigger={closeAllTrigger}
              onOpenPopup={handleOpenPopup}
            />
          </div>
        )}

        {/* Main content area for welcome and tree views */}
        {currentView !== 'chat' && !isGraphView && (
          <main
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              minHeight: isMobile ? 'calc(100vh - 56px)' : '100vh',
              padding: 'var(--space-4)',
            }}
          >
            {currentView === 'welcome' ? (
              /* ============================================
               * WELCOME VIEW
               * Shown when no question has been entered yet.
               * Centered layout with branding and input.
               * ============================================ */
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: isMobile ? 'flex-start' : 'center',
                  gap: isMobile ? 'var(--space-12)' : 'var(--space-8)',
                  width: '100%',
                  flex: 1,
                  paddingTop: isMobile ? 'var(--space-12)' : 0,
                }}
              >
                {/* Branding header */}
                {!isMobile && (
                  <header style={{ textAlign: 'center' }}>
                    <h1
                      style={{
                        fontSize: 'var(--text-4xl)',
                        fontWeight: 700,
                        letterSpacing: 'var(--tracking-tight)',
                        marginBottom: 'var(--space-2)',
                      }}
                    >
                      Fractal
                    </h1>
                  </header>
                )}
                
                {/* Central question input */}
                <QuestionInput onSubmit={handleQuestionSubmit} />
              </div>
            ) : (
              /* ============================================
               * TREE VIEW
               * Shown after a root question is entered.
               * Displays the branching question tree.
               * ============================================ */
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  width: '100%',
                  paddingTop: 'var(--space-8)',
                }}
              >
                {/* Minimal header in tree view */}
                {!isMobile && (
                  <header
                    style={{
                      textAlign: 'center',
                      marginBottom: 'var(--space-8)',
                    }}
                  >
                    <h1
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 'var(--text-lg)',
                        fontWeight: 600,
                        letterSpacing: 'var(--tracking-tight)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      Fractal
                    </h1>
                  </header>
                )}

                {/* AI error message */}
                {aiError && (
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 'var(--text-sm)',
                      color: 'var(--accent-error)',
                      marginBottom: 'var(--space-4)',
                      padding: 'var(--space-2) var(--space-4)',
                      border: 'var(--border-width) solid var(--accent-error)',
                      background: 'transparent',
                    }}
                  >
                    AI Error: {aiError}
                  </div>
                )}

                {lastMeta && (
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: isMobile ? '10px' : 'var(--text-xs)',
                      color: 'var(--text-tertiary)',
                      marginBottom: 'var(--space-4)',
                      textAlign: 'center',
                      padding: '0 var(--space-4)',
                      lineHeight: 1.4,
                    }}
                    data-onboarding="weave-score"
                  >
                    {isMobile ? (
                      <>
                        Quality: {lastMeta.qualityScore !== null ? lastMeta.qualityScore.toFixed(1) : '—'}/10<br />
                        Prompt: {lastMeta.promptLabel} · {lastMeta.evalModel.split('/').pop()}<br />
                        Conf: {lastMeta.confidence !== null ? `${(lastMeta.confidence * 100).toFixed(0)}%` : '—'} · Unc: {lastMeta.uncertainty !== null ? `${(lastMeta.uncertainty * 100).toFixed(0)}%` : '—'}
                      </>
                    ) : (
                      <>
                        Weave score: {lastMeta.qualityScore !== null ? lastMeta.qualityScore.toFixed(1) : '—'} / 10 · Prompt: {lastMeta.promptLabel} ({lastMeta.promptVariant}) · Eval model: {lastMeta.evalModel} · Confidence: {lastMeta.confidence !== null ? `${(lastMeta.confidence * 100).toFixed(0)}%` : '—'} · Uncertainty: {lastMeta.uncertainty !== null ? `${(lastMeta.uncertainty * 100).toFixed(0)}%` : '—'}
                      </>
                    )}
                    {(lastMeta.strengths.length > 0 || lastMeta.weaknesses.length > 0) && (
                      <div
                        style={{
                          marginTop: 'var(--space-2)',
                          textAlign: 'left',
                          maxWidth: '860px',
                          marginInline: 'auto',
                          border: 'var(--border-width) solid var(--border-primary)',
                          padding: 'var(--space-2)',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        {lastMeta.strengths.length > 0 && (
                          <div>
                            <strong>Judge strengths:</strong> {lastMeta.strengths.join('; ')}
                          </div>
                        )}
                        {lastMeta.weaknesses.length > 0 && (
                          <div>
                            <strong>Judge weaknesses:</strong> {lastMeta.weaknesses.join('; ')}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {(lastMeta?.costGuard?.isNearLimit || evalStats?.costGuard?.isNearLimit) && (
                  <div
                    style={{
                      width: 'min(960px, 100%)',
                      marginBottom: 'var(--space-3)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 'var(--text-xs)',
                      color: 'var(--accent-error)',
                      border: 'var(--border-width) solid var(--accent-error)',
                      padding: 'var(--space-2) var(--space-3)',
                      background: 'transparent',
                    }}
                  >
                    Token budget warning: {evalStats?.costGuard.usedTokens ?? lastMeta?.costGuard.usedTokens ?? 0}/
                    {evalStats?.costGuard.maxTokensPerSession ?? lastMeta?.costGuard.maxTokensPerSession ?? 0} tokens used.
                  </div>
                )}

                <div
                  style={{
                    width: 'min(960px, 100%)',
                    marginBottom: 'var(--space-3)',
                    border: 'var(--border-width) solid var(--border-primary)',
                    padding: 'var(--space-3)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: 'var(--space-2)',
                    }}
                  >
                    <strong>A/B Compare</strong>
                    <span>Target: {activeNode ? 'active node' : 'root node'}</span>
                    <select
                      value={compareRightModel ?? ''}
                      onChange={(event) => setCompareRightModel(event.target.value || null)}
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 'var(--text-xs)',
                        border: 'var(--border-width) solid var(--border-primary)',
                        background: 'var(--bg-primary)',
                        color: 'var(--text-secondary)',
                        padding: '2px 6px',
                      }}
                    >
                      <option value="">Right model: same as left</option>
                      {models.map((model) => (
                        <option key={model} value={model}>
                          {model}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={handleRunCompare}
                      disabled={compareLoading || (!activeNode && !rootNode)}
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 'var(--text-xs)',
                        border: 'var(--border-width) solid var(--border-primary)',
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-secondary)',
                        padding: '2px 8px',
                        cursor: compareLoading ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {compareLoading ? 'Comparing…' : 'Run Compare'}
                    </button>
                  </div>

                  {compareError && (
                    <div style={{ color: 'var(--accent-error)', marginTop: 'var(--space-2)' }}>
                      Compare error: {compareError}
                    </div>
                  )}

                  {compareResult && (
                    <div
                      style={{
                        marginTop: 'var(--space-2)',
                        display: 'grid',
                        gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                        gap: 'var(--space-2)',
                      }}
                    >
                      <div style={{ border: 'var(--border-width) solid var(--border-primary)', padding: 'var(--space-2)' }}>
                        <strong>Left</strong> · {compareResult.left.meta?.promptLabel} · Score {compareResult.left.meta?.qualityScore?.toFixed(2) ?? '—'}
                        <ul style={{ margin: 'var(--space-2) 0 0', paddingLeft: 'var(--space-4)' }}>
                          {compareResult.left.questions.map((question, index) => (
                            <li key={`left-${index}`}>{question}</li>
                          ))}
                        </ul>
                        <button
                          onClick={() => handleApplyCompareResult('left')}
                          style={{
                            marginTop: 'var(--space-2)',
                            fontFamily: 'var(--font-mono)',
                            fontSize: 'var(--text-xs)',
                            border: 'var(--border-width) solid var(--border-primary)',
                            background: 'var(--bg-secondary)',
                            color: 'var(--text-secondary)',
                            padding: '2px 8px',
                          }}
                        >
                          Apply Left
                        </button>
                      </div>

                      <div style={{ border: 'var(--border-width) solid var(--border-primary)', padding: 'var(--space-2)' }}>
                        <strong>Right</strong> · {compareResult.right.meta?.promptLabel} · Score {compareResult.right.meta?.qualityScore?.toFixed(2) ?? '—'}
                        <ul style={{ margin: 'var(--space-2) 0 0', paddingLeft: 'var(--space-4)' }}>
                          {compareResult.right.questions.map((question, index) => (
                            <li key={`right-${index}`}>{question}</li>
                          ))}
                        </ul>
                        <button
                          onClick={() => handleApplyCompareResult('right')}
                          style={{
                            marginTop: 'var(--space-2)',
                            fontFamily: 'var(--font-mono)',
                            fontSize: 'var(--text-xs)',
                            border: 'var(--border-width) solid var(--border-primary)',
                            background: 'var(--bg-secondary)',
                            color: 'var(--text-secondary)',
                            padding: '2px 8px',
                          }}
                        >
                          Apply Right
                        </button>
                      </div>

                      <div style={{ gridColumn: isMobile ? 'auto' : '1 / -1', color: 'var(--text-tertiary)' }}>
                        Winner: <strong>{compareResult.winner.toUpperCase()}</strong> · {compareResult.reason}
                      </div>
                    </div>
                  )}
                </div>

                <EvalPanel
                  stats={evalStats}
                  isLoading={evalStatsLoading}
                  error={evalStatsError}
                  onRefresh={() => {
                    void refreshEvalStats()
                  }}
                />

                {/* Question tree visualization */}
                <QuestionTree
                  tree={tree}
                  onSelectNode={handleSelectNode}
                  onAddChild={handleAddChild}
                  onToggleExpand={toggleNodeExpansion}
                  onGenerateAI={handleGenerateAI}
                  generatingNodeId={generatingNodeId}
                  onLockIn={handleLockIn}
                  nodeConcepts={nodeConcepts}
                  conceptExplanations={allExplanations}
                  conceptLoadingStates={explanationLoadingStates}
                  conceptExplanation={conceptExplanation}
                  isConceptLoading={explanationLoading}
                  conceptError={explanationError}
                  onConceptHover={handleConceptHover}
                  onConceptClick={handleConceptClick}
                  onAddUserConcept={handleAddUserConcept}
                  onRemoveConcept={handleRemoveConcept}
                  minimizeAllTrigger={minimizeAllTrigger}
                  closeAllTrigger={closeAllTrigger}
                  onOpenPopup={handleOpenPopup}
                  bestBranchNodeIds={bestBranchNodeIds}
                />

                {/* AI loading indicator */}
                {aiLoading && (
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 'var(--text-sm)',
                      color: 'var(--text-secondary)',
                      marginTop: 'var(--space-4)',
                    }}
                  >
                    ◌ Generating questions...
                  </div>
                )}

                {/* Reset button to start over */}
                <button
                  onClick={handleReset}
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--text-sm)',
                    color: 'var(--text-tertiary)',
                    marginTop: 'var(--space-12)',
                    padding: 'var(--space-2) var(--space-4)',
                    border: 'var(--border-width) solid var(--border-primary)',
                    background: 'transparent',
                    transition: 'border-color 0.2s, color 0.2s',
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.borderColor = 'var(--text-secondary)'
                    e.currentTarget.style.color = 'var(--text-secondary)'
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-primary)'
                    e.currentTarget.style.color = 'var(--text-tertiary)'
                  }}
                >
                  ← Start over
                </button>
              </div>
            )}
          </main>
        )}

        {!isGraphView && <ReplayTimeline events={replayEvents} />}

        {/* Canvas note popups */}
        {canvasNotes.map(note => (
          <NotePopup
            key={note.id}
            id={note.id}
            position={{ x: note.x, y: note.y }}
            initialTitle={note.title}
            initialContent={note.content}
            onClose={() => handleNoteClose(note.id)}
            onUpdate={handleNoteUpdate}
            onMinimizeChange={handleNoteMinimizeChange}
            minimizedStackIndex={minimizedNoteIds.indexOf(note.id)}
            readOnly={note.sourceType !== undefined && note.sourceType !== 'note'}
            sourceType={note.sourceType}
          />
        ))}

        {/* Reopened explanation popups from stash */}
        {reopenedExplanations.map(item => (
          <ConceptPopup
            key={item.id}
            concept={item.concept}
            explanation={item.explanation}
            isLoading={false}
            error={null}
            position={{ x: item.x, y: item.y }}
            onClose={() => handleReopenedExplanationClose(item.id)}
            onMinimizeChange={handleReopenedExplanationMinimizeChange}
            minimizedStackIndex={minimizedExplanationIds.indexOf(item.id)}
          />
        ))}

        {/* Global concept popups - persist across all views */}
        {globalPopups.map((popup) => {
          const explanation = allExplanations[popup.concept.id]
          const loadingState = explanationLoadingStates[popup.concept.id]
          const popupIsLoading = loadingState?.isLoading ?? false
          const popupError = loadingState?.error ?? null
          
          // Calculate stack index for minimized popups
          const minimizedStackIndex = minimizedGlobalPopupIds.indexOf(popup.concept.id)
          
          return (
            <ConceptPopup
              key={popup.concept.id}
              concept={popup.concept}
              explanation={explanation}
              isLoading={popupIsLoading}
              error={popupError}
              position={popup.position}
              onClose={() => handleClosePopup(popup.concept.id)}
              onRelatedConceptClick={handleRelatedConceptClick}
              onMinimizeChange={handlePopupMinimizeChange}
              minimizedStackIndex={minimizedStackIndex >= 0 ? minimizedStackIndex : undefined}
              externalIsMinimized={popup.isMinimized}
            />
          )
        })}

        <OnboardingOverlay
          isOpen={onboarding.isOpen}
          step={activeOnboardingStep}
          stepIndex={onboarding.currentStep}
          totalSteps={onboardingSteps.length}
          canProceed={canProceedOnboarding}
          onNext={onboarding.next}
          onPrev={onboarding.prev}
          onSkip={onboarding.skip}
          onRestart={onboarding.restart}
          onClose={onboarding.skip}
        />
      </div>
      
      {/* Probe sidebar - always available (right side) */}
      <ProbeSidebar />
    </div>
  )
}

/**
 * Root application component.
 * Wraps AppContent with StashProvider and ProbeProvider for global access.
 */
function App() {
  const shouldAutoLoadModels = import.meta.env.MODE !== 'test'

  return (
    <ViewModeProvider>
      <StashProvider>
        <ProbeProvider>
          <ModelProvider autoLoad={shouldAutoLoadModels}>
            <AppContent />
          </ModelProvider>
        </ProbeProvider>
      </StashProvider>
    </ViewModeProvider>
  )
}

export default App
