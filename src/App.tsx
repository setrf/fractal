import { useState } from 'react'
import { ThemeToggle } from './components/ThemeToggle'
import { QuestionInput } from './components/QuestionInput'

function App() {
  const [rootQuestion, setRootQuestion] = useState<string | null>(null)

  const handleQuestionSubmit = (question: string) => {
    setRootQuestion(question)
    console.log('Question submitted:', question)
  }

  return (
    <>
      <ThemeToggle />
      <main
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: 'var(--space-4)',
        }}
      >
        {!rootQuestion ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 'var(--space-8)',
              width: '100%',
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
              gap: 'var(--space-4)',
            }}
          >
            <p
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-lg)',
                color: 'var(--text-secondary)',
              }}
            >
              Exploring:
            </p>
            <h2
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-2xl)',
                fontWeight: 600,
                textAlign: 'center',
                maxWidth: '600px',
              }}
            >
              {rootQuestion}
            </h2>
            <button
              onClick={() => setRootQuestion(null)}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-sm)',
                color: 'var(--text-tertiary)',
                marginTop: 'var(--space-4)',
                textDecoration: 'underline',
                textUnderlineOffset: '4px',
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
