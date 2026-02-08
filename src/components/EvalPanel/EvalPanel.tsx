import type { EvalStatsResponse } from '../../api'
import styles from './EvalPanel.module.css'

type EvalStatsData = EvalStatsResponse['data']

interface EvalPanelProps {
  stats: EvalStatsData | null
  isLoading: boolean
  error: string | null
  onRefresh: () => void
}

export function EvalPanel({ stats, isLoading, error, onRefresh }: EvalPanelProps) {
  const promptVariants = stats?.promptVariants ?? []
  const recentRuns = stats?.recentRuns ?? []
  const modelPerformance = stats?.modelPerformance ?? []
  const totalUsage = stats?.tokenUsage?.total ?? {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  }
  const costGuard = stats?.costGuard ?? {
    maxTokensPerSession: 0,
    usedTokens: 0,
    remainingTokens: 0,
    warningThreshold: 0.8,
    usageRatio: 0,
    isNearLimit: false,
    isLimitExceeded: false,
  }

  return (
    <section className={styles.panel} data-onboarding="eval-panel">
      <div className={styles.header}>
        <h3 className={styles.title}>Eval Telemetry</h3>
        <button
          className={styles.refresh}
          onClick={onRefresh}
          disabled={isLoading}
          aria-label="Refresh eval telemetry"
        >
          {isLoading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {error && <p className={styles.error}>Eval error: {error}</p>}

      {!stats && !error && (
        <p className={styles.empty}>No eval data yet. Run a Deep dive first.</p>
      )}

      {stats && (
        <>
          <div className={styles.summaryRow}>
            <span>
              Tokens: <strong>{totalUsage.totalTokens}</strong>
            </span>
            <span>
              Budget: <strong>{costGuard.usedTokens}/{costGuard.maxTokensPerSession}</strong>
            </span>
            <span className={costGuard.isNearLimit ? styles.warning : undefined}>
              Ratio: <strong>{(costGuard.usageRatio * 100).toFixed(1)}%</strong>
            </span>
          </div>

          <details className={styles.details} open>
            <summary>Prompt Variant Leaderboard</summary>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Variant</th>
                    <th>Runs</th>
                    <th>Avg Score</th>
                    <th>Conf</th>
                    <th>Unc</th>
                    <th>Latency</th>
                  </tr>
                </thead>
                <tbody>
                  {promptVariants
                    .slice()
                    .sort((a, b) => b.avgScore - a.avgScore)
                    .map((variant) => (
                      <tr key={variant.id}>
                        <td>{variant.label}</td>
                        <td>{variant.count}</td>
                        <td>{variant.avgScore.toFixed(2)}</td>
                        <td>{variant.avgConfidence.toFixed(2)}</td>
                        <td>{variant.avgUncertainty.toFixed(2)}</td>
                        <td>{variant.avgLatencyMs.toFixed(0)}ms</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </details>

          <details className={styles.details}>
            <summary>Recent Eval Runs</summary>
            <ul className={styles.list}>
              {recentRuns.slice(0, 6).map((run, index) => (
                <li key={`${run.timestamp}-${index}`}>
                  <span>{run.score.toFixed(2)} ({run.variantLabel})</span>
                  <span>{run.question}</span>
                </li>
              ))}
            </ul>
          </details>

          <details className={styles.details}>
            <summary>Model Memory by Seed Type</summary>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Model</th>
                    <th>Seed</th>
                    <th>Runs</th>
                    <th>Avg Score</th>
                  </tr>
                </thead>
                <tbody>
                  {modelPerformance.slice(0, 8).map((entry) => (
                    <tr key={`${entry.model}-${entry.seedType}`}>
                      <td>{entry.model.split('/').pop()}</td>
                      <td>{entry.seedType}</td>
                      <td>{entry.count}</td>
                      <td>{entry.avgScore.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </section>
  )
}
