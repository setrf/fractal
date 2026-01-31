/**
 * @fileoverview Root application component for Fractal.
 * 
 * The App component manages the top-level application state and layout:
 * 
 * - When no root question exists: Shows the welcome view with QuestionInput
 * - When a root question exists: Shows the QuestionTree visualization
 * 
 * The component acts as the orchestrator, connecting the useQuestionTree
 * hook to the UI components.
 */

import { ThemeToggle } from './components/ThemeToggle'
import { QuestionInput } from './components/QuestionInput'
import { QuestionTree } from './components/QuestionTree'
import { useQuestionTree } from './hooks/useQuestionTree'

/**
 * Root application component.
 * 
 * Renders either:
 * 1. Welcome view with centered input (no root question)
 * 2. Tree view with branching questions (has root question)
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

  /**
   * Handles submission of the initial question.
   * Creates the root node and transitions to tree view.
   */
  const handleQuestionSubmit = (question: string) => {
    addRootQuestion(question)
  }

  return (
    <>
      {/* Theme toggle - always visible */}
      <ThemeToggle />
      
      <main
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          minHeight: '100vh',
          padding: 'var(--space-4)',
        }}
      >
        {!rootNode ? (
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

            {/* Question tree visualization */}
            <QuestionTree
              tree={tree}
              onSelectNode={setActiveNode}
              onAddChild={addChildQuestion}
              onToggleExpand={toggleNodeExpansion}
            />

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
    </>
  )
}

export default App
