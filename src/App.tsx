function App() {
  return (
    <main
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: 'var(--space-4)',
      }}
    >
      <div
        style={{
          textAlign: 'center',
          maxWidth: '600px',
        }}
      >
        <h1
          style={{
            fontSize: 'var(--text-4xl)',
            fontWeight: 700,
            letterSpacing: 'var(--tracking-tight)',
            marginBottom: 'var(--space-4)',
          }}
        >
          Fractal
        </h1>
        <p
          style={{
            fontSize: 'var(--text-lg)',
            color: 'var(--text-secondary)',
          }}
        >
          A place for questions, not answers.
        </p>
      </div>
    </main>
  )
}

export default App
