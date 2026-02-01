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

import { useState, useCallback, useEffect, useRef } from 'react'
import { ThemeToggle } from './components/ThemeToggle'
import { QuestionInput } from './components/QuestionInput'
import { QuestionTree } from './components/QuestionTree'
import { ChatView } from './components/ChatView'
import { StashSidebar } from './components/StashSidebar'
import { NotePopup } from './components/NotePopup'
import { StashProvider, useStashContext } from './context/StashContext'
import { useQuestionTree } from './hooks/useQuestionTree'
import { useAIQuestions } from './hooks/useAIQuestions'
import { useConceptExtraction } from './hooks/useConceptExtraction'
import { useConceptExplanation } from './hooks/useConceptExplanation'
import { sendChatMessage, type ChatMessage, type ExtractedConcept } from './api'
import type { StashItem as StashItemData } from './types/stash'

/**
 * View type for the application.
 */
type AppView = 'welcome' | 'tree' | 'chat'

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
  // Get stash state for sidebar layout
  const { isOpen: stashOpen } = useStashContext()
  // Initialize the question tree state and operations
  const {
    tree,
    rootNode,
    addRootQuestion,
    addChildQuestion,
    setActiveNode,
    toggleNodeExpansion,
    reset,
  } = useQuestionTree()

  // AI question generation
  const { generate, isLoading: aiLoading, error: aiError } = useAIQuestions()
  
  // Concept extraction and explanation
  const { extract: extractConcepts } = useConceptExtraction()
  
  const {
    explanation: conceptExplanation,
    explanations: allExplanations,
    loadingStates: explanationLoadingStates,
    isLoading: explanationLoading,
    error: explanationError,
    fetchExplanation,
    getExplanation,
    getLoadingState,
    reset: resetExplanation,
  } = useConceptExplanation()
  
  // Track which node is currently generating
  const [generatingNodeId, setGeneratingNodeId] = useState<string | null>(null)
  
  // Track concepts per node (nodeId -> concepts)
  const [nodeConcepts, setNodeConcepts] = useState<Record<string, ExtractedConcept[]>>({})

  // View state for navigating between tree and chat
  const [chatState, setChatState] = useState<ChatState | null>(null)
  
  // Canvas note popups
  const [canvasNotes, setCanvasNotes] = useState<CanvasNote[]>([])
  const noteIdCounter = useRef(0)
  
  // Track which notes are minimized for stacking
  const minimizedNoteIds = canvasNotes.filter(n => n.isMinimized).map(n => n.id)

  // Determine current view
  const currentView: AppView = !rootNode ? 'welcome' : chatState ? 'chat' : 'tree'
  
  // Extract concepts for root node when it changes
  useEffect(() => {
    if (rootNode && !nodeConcepts[rootNode.id]) {
      extractConcepts(rootNode.text).then((extracted) => {
        if (extracted.length > 0) {
          setNodeConcepts(prev => ({ ...prev, [rootNode.id]: extracted }))
        }
      })
    }
  }, [rootNode, nodeConcepts, extractConcepts])

  /**
   * Handles node selection - wraps setActiveNode to also trigger concept extraction.
   * When a node is selected, we automatically extract concepts if not already done.
   */
  const handleSelectNode = useCallback((nodeId: string) => {
    setActiveNode(nodeId)
    
    // Auto-extract concepts for the selected node if not already done
    const node = tree.nodes[nodeId]
    if (node && !nodeConcepts[nodeId]) {
      extractConcepts(node.text).then((extracted) => {
        if (extracted.length > 0) {
          setNodeConcepts(prev => ({ ...prev, [nodeId]: extracted }))
        }
      })
    }
  }, [tree.nodes, nodeConcepts, extractConcepts, setActiveNode])

  /**
   * Generates AI suggestions for a node and adds them as children.
   * Uses W&B Inference via the backend server.
   */
  const handleGenerateAI = useCallback(async (parentId: string, question: string) => {
    setGeneratingNodeId(parentId)
    try {
      const suggestions = await generate(question)
      // Add each generated question as a child
      for (const suggestion of suggestions) {
        addChildQuestion(parentId, suggestion)
      }
    } finally {
      setGeneratingNodeId(null)
    }
  }, [generate, addChildQuestion])

  /**
   * Handles submission of the initial question.
   * Creates the root node and immediately triggers Deep dive.
   */
  const handleQuestionSubmit = useCallback((question: string) => {
    const nodeId = addRootQuestion(question)
    // Immediately trigger Deep dive to generate sub-questions
    handleGenerateAI(nodeId, question)
  }, [addRootQuestion, handleGenerateAI])

  /**
   * Handles "lock in" on a question to open the chat view.
   */
  const handleLockIn = useCallback((nodeId: string, question: string) => {
    setChatState({ nodeId, question })
  }, [])

  /**
   * Returns from chat view to tree view.
   */
  const handleBackToTree = useCallback(() => {
    setChatState(null)
  }, [])

  /**
   * Sends a chat message and returns the response.
   */
  const handleSendChatMessage = useCallback(async (messages: ChatMessage[]): Promise<string> => {
    if (!chatState) throw new Error('No chat state')
    return sendChatMessage(chatState.question, messages)
  }, [chatState])

  /**
   * Handles concept hover - fetches explanation.
   */
  const handleConceptHover = useCallback((concept: ExtractedConcept) => {
    // Get the question context from the current view
    const questionContext = chatState?.question || rootNode?.text || ''
    if (questionContext) {
      fetchExplanation(concept.id, concept.normalizedName, questionContext)
    }
  }, [chatState, rootNode, fetchExplanation])

  /**
   * Handles concept click - same as hover for now, but could trigger sticky.
   */
  const handleConceptClick = useCallback((concept: ExtractedConcept) => {
    const questionContext = chatState?.question || rootNode?.text || ''
    if (questionContext) {
      fetchExplanation(concept.id, concept.normalizedName, questionContext)
    }
  }, [chatState, rootNode, fetchExplanation])

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
    setChatState(null)
    resetExplanation()
    setCanvasNotes([])
  }, [reset, resetExplanation])

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
  }, [])

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
   * Handles clicking a stash item to reopen it as a popup.
   */
  const handleStashItemClick = useCallback((item: StashItemData) => {
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
      // Reopen as read-only viewer
      const summary = item.metadata.summary || ''
      const context = item.metadata.context || ''
      const content = summary + (context ? `\n\n---\n\n${context}` : '')
      const newNote: CanvasNote = {
        id,
        x,
        y,
        title: item.content, // The concept name
        content,
        isMinimized: false,
        sourceType: 'explanation',
      }
      setCanvasNotes(prev => [...prev, newNote])
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
  }, [])

  return (
    <div className={`app-layout ${stashOpen ? 'stash-open' : 'stash-collapsed'}`}>
      {/* Stash sidebar - always available */}
      <StashSidebar onItemClick={handleStashItemClick} />
      
      {/* Main content area */}
      <div className="main-content">
        {/* Theme toggle - always visible (except in chat view which has its own layout) */}
        {currentView !== 'chat' && <ThemeToggle />}
        
        {/* New Note button - fixed in upper left after stash */}
        {currentView !== 'chat' && (
          <button
            onClick={handleCreateNote}
            style={{
              position: 'fixed',
              top: 'var(--space-3)',
              left: stashOpen ? 'calc(320px + var(--space-3))' : 'calc(48px + var(--space-3))',
              padding: 'var(--space-2) var(--space-3)',
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-sm)',
              background: 'var(--bg-primary)',
              border: 'var(--border-width) solid var(--border-primary)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              zIndex: 99,
              transition: 'left var(--transition-normal), border-color 0.2s, color 0.2s',
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
        )}
        
        {/* ============================================
         * CHAT VIEW
         * Shown when a question is "locked in" for deep exploration.
         * ============================================ */}
        {currentView === 'chat' && chatState && (
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
          />
        )}

        {/* Main content area for welcome and tree views */}
        {currentView !== 'chat' && (
          <main
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              minHeight: '100vh',
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
                  justifyContent: 'center',
                  gap: 'var(--space-8)',
                  width: '100%',
                  flex: 1,
                }}
              >
                {/* Branding header */}
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
                  <p
                    style={{
                      fontSize: 'var(--text-base)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    A place for questions, not answers.
                  </p>
                </header>
                
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

                {/* Question tree visualization */}
                <QuestionTree
                  tree={tree}
                  onSelectNode={handleSelectNode}
                  onAddChild={addChildQuestion}
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
      </div>
    </div>
  )
}

/**
 * Root application component.
 * Wraps AppContent with the StashProvider for global stash access.
 */
function App() {
  return (
    <StashProvider>
      <AppContent />
    </StashProvider>
  )
}

export default App
