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

import { useState, useCallback } from 'react'
import { ThemeToggle } from './components/ThemeToggle'
import { QuestionInput } from './components/QuestionInput'
import { QuestionTree } from './components/QuestionTree'
import { ChatView } from './components/ChatView'
import { useQuestionTree } from './hooks/useQuestionTree'
import { useAIQuestions } from './hooks/useAIQuestions'
import { sendChatMessage, type ChatMessage } from './api'

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
 * Root application component.
 * 
 * Renders either:
 * 1. Welcome view with centered input (no root question)
 * 2. Tree view with branching questions (has root question)
 * 3. Chat view for deep exploration of a specific question
 * 
 * The ThemeToggle is always visible in the top-right corner.
 */
function App() {
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
  
  // Track which node is currently generating
  const [generatingNodeId, setGeneratingNodeId] = useState<string | null>(null)

  // View state for navigating between tree and chat
  const [chatState, setChatState] = useState<ChatState | null>(null)

  // Determine current view
  const currentView: AppView = !rootNode ? 'welcome' : chatState ? 'chat' : 'tree'

  /**
   * Handles submission of the initial question.
   * Creates the root node and transitions to tree view.
   */
  const handleQuestionSubmit = (question: string) => {
    addRootQuestion(question)
  }

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

  return (
    <>
      {/* Theme toggle - always visible (except in chat view which has its own layout) */}
      {currentView !== 'chat' && <ThemeToggle />}
      
      {/* ============================================
       * CHAT VIEW
       * Shown when a question is "locked in" for deep exploration.
       * ============================================ */}
      {currentView === 'chat' && chatState && (
        <ChatView
          question={chatState.question}
          onBack={handleBackToTree}
          onSendMessage={handleSendChatMessage}
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
                onSelectNode={setActiveNode}
                onAddChild={addChildQuestion}
                onToggleExpand={toggleNodeExpansion}
                onGenerateAI={handleGenerateAI}
                generatingNodeId={generatingNodeId}
                onLockIn={handleLockIn}
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
                onClick={reset}
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
    </>
  )
}

export default App
