import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '../../test/test-utils'
import { EvalPanel } from './EvalPanel'
import type { EvalStatsResponse } from '../../api'

function createStats(
  overrides: Partial<EvalStatsResponse['data']> = {}
): EvalStatsResponse['data'] {
  return {
    promptVariants: [
      {
        id: 'v1',
        label: 'Variant A',
        count: 4,
        avgScore: 0.73,
        avgConfidence: 0.65,
        avgUncertainty: 0.18,
        avgLatencyMs: 410,
        lastScore: 0.7,
        lastUpdatedAt: '2024-01-01T00:00:00.000Z',
      },
      {
        id: 'v2',
        label: 'Variant B',
        count: 7,
        avgScore: 0.82,
        avgConfidence: 0.72,
        avgUncertainty: 0.14,
        avgLatencyMs: 330,
        lastScore: 0.84,
        lastUpdatedAt: '2024-01-01T00:00:00.000Z',
      },
    ],
    recentRuns: Array.from({ length: 8 }, (_, idx) => ({
      timestamp: `2024-01-01T00:00:0${idx}Z`,
      question: `Question ${idx}`,
      variantId: idx % 2 === 0 ? 'v1' : 'v2',
      variantLabel: idx % 2 === 0 ? 'Variant A' : 'Variant B',
      model: 'openai/gpt-4.1-mini',
      seedType: 'root',
      score: 0.5 + idx * 0.01,
      confidence: 0.7,
      uncertainty: 0.2,
      latencyMs: 120 + idx,
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      strengths: ['clarity'],
      weaknesses: ['depth'],
    })),
    tokenUsage: {
      total: {
        promptTokens: 1200,
        completionTokens: 800,
        totalTokens: 2000,
      },
      byOperation: {},
    },
    costGuard: {
      maxTokensPerSession: 2500,
      usedTokens: 2000,
      remainingTokens: 500,
      warningThreshold: 0.8,
      usageRatio: 0.8,
      isNearLimit: true,
      isLimitExceeded: false,
    },
    modelPerformance: [
      {
        model: 'openai/gpt-4.1-mini',
        seedType: 'root',
        count: 5,
        avgScore: 0.81,
        lastScore: 0.82,
        lastUpdatedAt: '2024-01-01T00:00:00.000Z',
      },
      {
        model: 'openai/gpt-4.1',
        seedType: 'followup',
        count: 3,
        avgScore: 0.78,
        lastScore: 0.8,
        lastUpdatedAt: '2024-01-01T00:00:00.000Z',
      },
    ],
    topModelBySeedType: {
      root: 'openai/gpt-4.1-mini',
      followup: 'openai/gpt-4.1',
    },
    ...overrides,
  }
}

describe('EvalPanel', () => {
  it('shows empty state when there is no stats payload', () => {
    const onRefresh = vi.fn()
    render(
      <EvalPanel
        stats={null}
        isLoading={false}
        error={null}
        onRefresh={onRefresh}
      />
    )

    expect(screen.getByText(/No eval data yet/i)).toBeInTheDocument()
    screen.getByRole('button', { name: /Refresh eval telemetry/i }).click()
    expect(onRefresh).toHaveBeenCalledTimes(1)
  })

  it('renders loading and error states', () => {
    render(
      <EvalPanel
        stats={null}
        isLoading={true}
        error="timeout"
        onRefresh={vi.fn()}
      />
    )

    expect(screen.getByText(/Eval error: timeout/i)).toBeInTheDocument()
    const refresh = screen.getByRole('button', { name: /Refresh eval telemetry/i })
    expect(refresh).toBeDisabled()
    expect(refresh).toHaveTextContent('Refreshing…')
  })

  it('renders telemetry tables and sorts prompt variants by score', () => {
    render(
      <EvalPanel
        stats={createStats()}
        isLoading={false}
        error={null}
        onRefresh={vi.fn()}
      />
    )

    expect(screen.getByText(/Tokens:/i)).toBeInTheDocument()
    expect(screen.getByText(/Budget:/i)).toBeInTheDocument()
    expect(screen.getByText(/Ratio:/i)).toBeInTheDocument()
    expect(screen.getByText('80.0%')).toBeInTheDocument()

    const leaderboard = screen.getByText(/Prompt Variant Leaderboard/i).closest('details')
    expect(leaderboard).toBeInTheDocument()
    const rows = leaderboard?.querySelectorAll('tbody tr') ?? []
    expect(rows.length).toBe(2)
    expect(rows[0].textContent).toContain('Variant B')
    expect(rows[1].textContent).toContain('Variant A')

    const runItems = screen
      .getByText(/Recent Eval Runs/i)
      .closest('details')
      ?.querySelectorAll('li') ?? []
    expect(runItems.length).toBe(6)

    expect(screen.getByText('gpt-4.1-mini')).toBeInTheDocument()
    expect(screen.getByText('gpt-4.1')).toBeInTheDocument()
  })

  it('falls back to safe defaults when optional stats sections are missing', () => {
    const partial = {
      promptVariants: [],
      recentRuns: [],
      modelPerformance: [],
    } as EvalStatsResponse['data']

    render(
      <EvalPanel
        stats={partial}
        isLoading={false}
        error={null}
        onRefresh={vi.fn()}
      />
    )

    expect(screen.getByText(/Tokens:/i)).toHaveTextContent('Tokens: 0')
    expect(screen.getByText(/Budget:/i)).toHaveTextContent('Budget: 0/0')
    expect(screen.getByText(/Ratio:/i)).toHaveTextContent('Ratio: 0.0%')
  })
})
