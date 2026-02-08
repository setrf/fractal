/**
 * Golden Regression Eval Runner
 * =============================
 *
 * Runs a fixed prompt set against each question-generation prompt strategy,
 * scores outputs with the built-in judge, and writes a markdown report.
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { generateRelatedQuestions } from '../src/inference.js'
import { initializeWeave } from '../src/weave-client.js'
import { config } from '../src/config.js'

const GOLDEN_QUESTIONS = [
  'Why does time feel faster as we age?',
  'Why do people procrastinate on tasks they care about?',
  'How can product teams reduce launch risk?',
  'What if social platforms optimized for learning over engagement?',
  'Why do some songs get stuck in our heads?',
  'How should we evaluate AI feature quality in production?',
  'What drives trust in AI-generated recommendations?',
  'Why do teams repeat avoidable product mistakes?',
  'How can we measure curiosity depth in user behavior?',
  'What if we redesigned search around better questions?',
]

const VARIANTS = ['v1-balanced', 'v2-divergent', 'v3-structured'] as const

interface EvalRow {
  question: string
  variantId: string
  score: number
  confidence: number
  uncertainty: number
  strengths: string[]
  weaknesses: string[]
}

function timestampForFile(date: Date): string {
  return date.toISOString().replace(/[:.]/g, '-')
}

function toMarkdown(rows: EvalRow[]): string {
  const createdAt = new Date().toISOString()

  const variantAggregates = VARIANTS.map((variantId) => {
    const subset = rows.filter((row) => row.variantId === variantId)
    const avgScore = subset.reduce((sum, row) => sum + row.score, 0) / Math.max(1, subset.length)
    const avgConfidence = subset.reduce((sum, row) => sum + row.confidence, 0) / Math.max(1, subset.length)
    const avgUncertainty = subset.reduce((sum, row) => sum + row.uncertainty, 0) / Math.max(1, subset.length)
    return {
      variantId,
      count: subset.length,
      avgScore,
      avgConfidence,
      avgUncertainty,
    }
  }).sort((a, b) => b.avgScore - a.avgScore)

  const lines: string[] = []
  lines.push('# Golden Eval Report')
  lines.push('')
  lines.push(`Generated at: ${createdAt}`)
  lines.push(`Model: ${config.defaultModel}`)
  lines.push(`Questions: ${GOLDEN_QUESTIONS.length}`)
  lines.push('')
  lines.push('## Variant Summary')
  lines.push('')
  lines.push('| Variant | Runs | Avg Score | Avg Confidence | Avg Uncertainty |')
  lines.push('|---|---:|---:|---:|---:|')
  variantAggregates.forEach((item) => {
    lines.push(
      `| ${item.variantId} | ${item.count} | ${item.avgScore.toFixed(2)} | ${item.avgConfidence.toFixed(2)} | ${item.avgUncertainty.toFixed(2)} |`
    )
  })
  lines.push('')
  lines.push('## Per-Question Results')
  lines.push('')
  lines.push('| Question | Variant | Score | Confidence | Uncertainty |')
  lines.push('|---|---|---:|---:|---:|')
  rows.forEach((row) => {
    lines.push(
      `| ${row.question.replace(/\|/g, '\\|')} | ${row.variantId} | ${row.score.toFixed(2)} | ${row.confidence.toFixed(2)} | ${row.uncertainty.toFixed(2)} |`
    )
  })
  lines.push('')
  lines.push('## Notable Judge Feedback')
  lines.push('')
  rows.slice(0, 15).forEach((row) => {
    lines.push(`### ${row.variantId} · ${row.question}`)
    lines.push(`- Score: ${row.score.toFixed(2)} (confidence ${row.confidence.toFixed(2)})`)
    lines.push(`- Strengths: ${row.strengths.join('; ') || 'N/A'}`)
    lines.push(`- Weaknesses: ${row.weaknesses.join('; ') || 'N/A'}`)
    lines.push('')
  })
  return lines.join('\n')
}

async function main(): Promise<void> {
  await initializeWeave()
  const rows: EvalRow[] = []

  for (const question of GOLDEN_QUESTIONS) {
    for (const variantId of VARIANTS) {
      const result = await generateRelatedQuestions(question, config.defaultModel, {
        forcedPromptVariantId: variantId,
        updatePolicy: false,
      })
      rows.push({
        question,
        variantId,
        score: result.meta.qualityScore ?? 0,
        confidence: result.meta.confidence ?? 0,
        uncertainty: result.meta.uncertainty ?? 1,
        strengths: result.meta.strengths,
        weaknesses: result.meta.weaknesses,
      })
      console.log(
        `[GoldenEval] ${variantId} | ${question.slice(0, 50)}... => ${(
          result.meta.qualityScore ?? 0
        ).toFixed(2)}`
      )
    }
  }

  const report = toMarkdown(rows)
  const reportsDir = path.resolve(process.cwd(), 'reports')
  await fs.mkdir(reportsDir, { recursive: true })
  const outputPath = path.join(reportsDir, `golden-evals-${timestampForFile(new Date())}.md`)
  await fs.writeFile(outputPath, report, 'utf8')
  console.log(`[GoldenEval] Report written to ${outputPath}`)
}

main().catch((error) => {
  console.error('[GoldenEval] Failed:', error)
  process.exit(1)
})
