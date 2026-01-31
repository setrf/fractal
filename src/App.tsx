import { ThemeToggle } from './components/ThemeToggle'
import { QuestionInput } from './components/QuestionInput'
import { QuestionTree } from './components/QuestionTree'
import { useQuestionTree } from './hooks/useQuestionTree'

function App() {
  const {
    tree,
    rootNode,
    addRootQuestion,
    addChildQuestion,
    setActiveNode,
    toggleNodeExpansion,
    reset,
  } = useQuestionTree()

  const handleQuestionSubmit = (question: string) => {
    addRootQuestion(question)
  }

  return (
    <>
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
            <QuestionInput onSubmit={handleQuestionSubmit} />
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              width: '100%',
              paddingTop: 'var(--space-8)',
            }}
          >
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

            <QuestionTree
              tree={tree}
              onSelectNode={setActiveNode}
              onAddChild={addChildQuestion}
              onToggleExpand={toggleNodeExpansion}
            />

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
