/**
 * Eval State
 * ==========
 *
 * Tracks online evaluation telemetry for adaptive prompting:
 * - Prompt-variant performance
 * - Model performance by seed type
 * - Recent eval runs
 * - Session token usage and budget guardrails
 *
 * Prompt/model memories are persisted to disk so adaptation survives restarts.
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'

export type SeedType =
  | 'causal'
  | 'mechanistic'
  | 'counterfactual'
  | 'comparative'
  | 'decision'
  | 'exploratory'

export interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export interface PromptVariantDescriptor {
  id: string
  label: string
}

interface PromptPolicyStat {
  count: number
  avgScore: number
  avgConfidence: number
  avgUncertainty: number
  avgLatencyMs: number
  lastScore: number | null
  lastUpdatedAt: string | null
}

interface ModelSeedStat {
  model: string
  seedType: SeedType
  count: number
  avgScore: number
  lastScore: number | null
  lastUpdatedAt: string | null
}

export interface EvalRunRecord {
  timestamp: string
  question: string
  variantId: string
  variantLabel: string
  model: string
  seedType: SeedType
  score: number
  confidence: number | null
  uncertainty: number | null
  latencyMs: number
  usage: TokenUsage
  strengths: string[]
  weaknesses: string[]
}

interface PersistedPolicyMemory {
  version: 1
  promptStats: Record<string, PromptPolicyStat>
  modelSeedStats: Record<string, ModelSeedStat>
}

export interface PromptVariantSnapshot {
  id: string
  label: string
  count: number
  avgScore: number
  avgConfidence: number
  avgUncertainty: number
  avgLatencyMs: number
  lastScore: number | null
  lastUpdatedAt: string | null
}

export interface ModelSeedSnapshot {
  model: string
  seedType: SeedType
  count: number
  avgScore: number
  lastScore: number | null
  lastUpdatedAt: string | null
}

export interface CostGuardSnapshot {
  maxTokensPerSession: number
  usedTokens: number
  remainingTokens: number
  warningThreshold: number
  usageRatio: number
  isNearLimit: boolean
  isLimitExceeded: boolean
}

export interface EvalStatsSnapshot {
  promptVariants: PromptVariantSnapshot[]
  recentRuns: EvalRunRecord[]
  tokenUsage: {
    total: TokenUsage
    byOperation: Record<string, TokenUsage>
  }
  costGuard: CostGuardSnapshot
  modelPerformance: ModelSeedSnapshot[]
  topModelBySeedType: Partial<Record<SeedType, string>>
}

const isTestMode = process.env.NODE_ENV === 'test'
const MAX_RECENT_RUNS = 50
const SAVE_DEBOUNCE_MS = 250

const promptStats = new Map<string, PromptPolicyStat>()
const modelSeedStats = new Map<string, ModelSeedStat>()
const recentRuns: EvalRunRecord[] = []

const tokenTotals: TokenUsage = {
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
}

const tokenByOperation = new Map<string, TokenUsage>()

let policyMemoryPath = './data/policy-memory.json'
let maxTokensPerSession = 40_000
let tokenWarningThreshold = 0.8

let loaded = false
let loadPromise: Promise<void> | null = null
let saveTimer: NodeJS.Timeout | null = null

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

function makeModelSeedKey(model: string, seedType: SeedType): string {
  return `${model}::${seedType}`
}

function ensureByOperationBucket(operation: string): TokenUsage {
  const existing = tokenByOperation.get(operation)
  if (existing) return existing
  const created: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
  tokenByOperation.set(operation, created)
  return created
}

function updateRunningAverage(prevAvg: number, prevCount: number, nextValue: number): number {
  const nextCount = prevCount + 1
  return (prevAvg * prevCount + nextValue) / nextCount
}

function normalizePolicyMemoryPath(input: string): string {
  if (path.isAbsolute(input)) return input
  return path.resolve(process.cwd(), input)
}

function toPersistedMemory(): PersistedPolicyMemory {
  return {
    version: 1,
    promptStats: Object.fromEntries(promptStats.entries()),
    modelSeedStats: Object.fromEntries(modelSeedStats.entries()),
  }
}

function scheduleSaveToDisk(): void {
  if (isTestMode) return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = null
    void savePolicyMemory()
  }, SAVE_DEBOUNCE_MS)
}

async function savePolicyMemory(): Promise<void> {
  try {
    const fullPath = normalizePolicyMemoryPath(policyMemoryPath)
    await fs.mkdir(path.dirname(fullPath), { recursive: true })
    await fs.writeFile(fullPath, JSON.stringify(toPersistedMemory(), null, 2), 'utf8')
  } catch (error) {
    console.warn('[EvalState] Failed to persist policy memory:', error)
  }
}

async function loadPolicyMemoryFromDisk(): Promise<void> {
  if (isTestMode) {
    loaded = true
    return
  }

  const fullPath = normalizePolicyMemoryPath(policyMemoryPath)
  try {
    const raw = await fs.readFile(fullPath, 'utf8')
    const parsed = JSON.parse(raw) as Partial<PersistedPolicyMemory>
    if (parsed?.version !== 1) {
      loaded = true
      return
    }

    const filePromptStats = parsed.promptStats ?? {}
    Object.entries(filePromptStats).forEach(([variantId, stat]) => {
      if (!stat || typeof stat !== 'object') return
      promptStats.set(variantId, {
        count: typeof stat.count === 'number' ? stat.count : 0,
        avgScore: typeof stat.avgScore === 'number' ? stat.avgScore : 0,
        avgConfidence: typeof stat.avgConfidence === 'number' ? stat.avgConfidence : 0,
        avgUncertainty: typeof stat.avgUncertainty === 'number' ? stat.avgUncertainty : 1,
        avgLatencyMs: typeof stat.avgLatencyMs === 'number' ? stat.avgLatencyMs : 0,
        lastScore: typeof stat.lastScore === 'number' ? stat.lastScore : null,
        lastUpdatedAt: typeof stat.lastUpdatedAt === 'string' ? stat.lastUpdatedAt : null,
      })
    })

    const fileModelSeedStats = parsed.modelSeedStats ?? {}
    Object.entries(fileModelSeedStats).forEach(([key, stat]) => {
      if (!stat || typeof stat !== 'object') return
      if (typeof stat.model !== 'string' || typeof stat.seedType !== 'string') return
      modelSeedStats.set(key, {
        model: stat.model,
        seedType: stat.seedType as SeedType,
        count: typeof stat.count === 'number' ? stat.count : 0,
        avgScore: typeof stat.avgScore === 'number' ? stat.avgScore : 0,
        lastScore: typeof stat.lastScore === 'number' ? stat.lastScore : null,
        lastUpdatedAt: typeof stat.lastUpdatedAt === 'string' ? stat.lastUpdatedAt : null,
      })
    })
  } catch {
    // Missing file is expected on first run.
  } finally {
    loaded = true
  }
}

export function configureEvalState(options: {
  policyPath: string
  maxTokensPerSession: number
  tokenWarningThreshold: number
}): void {
  policyMemoryPath = options.policyPath
  maxTokensPerSession = Number.isFinite(options.maxTokensPerSession) && options.maxTokensPerSession > 0
    ? Math.floor(options.maxTokensPerSession)
    : maxTokensPerSession
  tokenWarningThreshold = clamp01(options.tokenWarningThreshold)
}

export async function ensureEvalStateLoaded(): Promise<void> {
  if (loaded) return
  if (loadPromise) return loadPromise
  loadPromise = loadPolicyMemoryFromDisk().finally(() => {
    loadPromise = null
  })
  return loadPromise
}

export function classifySeedType(question: string): SeedType {
  const normalized = question.trim().toLowerCase()
  if (!normalized) return 'exploratory'
  if (normalized.startsWith('why ') || normalized.startsWith('why?')) return 'causal'
  if (normalized.startsWith('how ') || normalized.startsWith('how?')) return 'mechanistic'
  if (normalized.includes('what if')) return 'counterfactual'
  if (normalized.includes(' vs ') || normalized.includes('compare')) return 'comparative'
  if (normalized.startsWith('should ') || normalized.startsWith('could ') || normalized.startsWith('would ')) {
    return 'decision'
  }
  return 'exploratory'
}

export function selectPromptVariant<T extends PromptVariantDescriptor>(
  variants: T[],
  epsilon: number
): T {
  if (variants.length === 0) {
    throw new Error('No prompt variants configured')
  }

  if (Math.random() < epsilon) {
    return variants[Math.floor(Math.random() * variants.length)]
  }

  let bestVariant = variants[0]
  let bestScore = -Infinity
  variants.forEach((variant) => {
    const score = promptStats.get(variant.id)?.avgScore ?? 0
    if (score > bestScore) {
      bestScore = score
      bestVariant = variant
    }
  })
  return bestVariant
}

export function rankPromptVariants<T extends PromptVariantDescriptor>(
  variants: T[]
): T[] {
  return [...variants].sort((a, b) => {
    const scoreA = promptStats.get(a.id)?.avgScore ?? 0
    const scoreB = promptStats.get(b.id)?.avgScore ?? 0
    return scoreB - scoreA
  })
}

export function recordTokenUsage(operation: string, usage: TokenUsage): void {
  const promptTokens = Number.isFinite(usage.promptTokens) ? Math.max(0, usage.promptTokens) : 0
  const completionTokens = Number.isFinite(usage.completionTokens) ? Math.max(0, usage.completionTokens) : 0
  const totalTokens = Number.isFinite(usage.totalTokens) ? Math.max(0, usage.totalTokens) : promptTokens + completionTokens

  tokenTotals.promptTokens += promptTokens
  tokenTotals.completionTokens += completionTokens
  tokenTotals.totalTokens += totalTokens

  const bucket = ensureByOperationBucket(operation)
  bucket.promptTokens += promptTokens
  bucket.completionTokens += completionTokens
  bucket.totalTokens += totalTokens
}

export function getCostGuardSnapshot(): CostGuardSnapshot {
  const used = tokenTotals.totalTokens
  const max = maxTokensPerSession
  const remaining = Math.max(0, max - used)
  const usageRatio = max > 0 ? used / max : 0

  return {
    maxTokensPerSession: max,
    usedTokens: used,
    remainingTokens: remaining,
    warningThreshold: tokenWarningThreshold,
    usageRatio,
    isNearLimit: usageRatio >= tokenWarningThreshold && used < max,
    isLimitExceeded: used >= max,
  }
}

export function assertTokenBudget(operation: string): void {
  const guard = getCostGuardSnapshot()
  if (guard.isLimitExceeded) {
    throw new Error(
      `Token budget exceeded for session (${guard.usedTokens}/${guard.maxTokensPerSession}) before ${operation}. ` +
      'Restart server or raise MAX_TOKENS_PER_SESSION.'
    )
  }
}

export function recordEvalRun(input: {
  question: string
  variantId: string
  variantLabel: string
  model: string
  seedType: SeedType
  score: number
  confidence: number | null
  uncertainty: number | null
  latencyMs: number
  usage: TokenUsage
  strengths: string[]
  weaknesses: string[]
  updatePolicy: boolean
}): void {
  const nowIso = new Date().toISOString()

  if (input.updatePolicy) {
    const previous = promptStats.get(input.variantId)
    if (!previous) {
      promptStats.set(input.variantId, {
        count: 1,
        avgScore: input.score,
        avgConfidence: input.confidence ?? 0,
        avgUncertainty: input.uncertainty ?? 1,
        avgLatencyMs: input.latencyMs,
        lastScore: input.score,
        lastUpdatedAt: nowIso,
      })
    } else {
      const nextCount = previous.count + 1
      promptStats.set(input.variantId, {
        count: nextCount,
        avgScore: updateRunningAverage(previous.avgScore, previous.count, input.score),
        avgConfidence: updateRunningAverage(previous.avgConfidence, previous.count, input.confidence ?? 0),
        avgUncertainty: updateRunningAverage(previous.avgUncertainty, previous.count, input.uncertainty ?? 1),
        avgLatencyMs: updateRunningAverage(previous.avgLatencyMs, previous.count, input.latencyMs),
        lastScore: input.score,
        lastUpdatedAt: nowIso,
      })
    }

    const modelSeedKey = makeModelSeedKey(input.model, input.seedType)
    const previousModelSeed = modelSeedStats.get(modelSeedKey)
    if (!previousModelSeed) {
      modelSeedStats.set(modelSeedKey, {
        model: input.model,
        seedType: input.seedType,
        count: 1,
        avgScore: input.score,
        lastScore: input.score,
        lastUpdatedAt: nowIso,
      })
    } else {
      modelSeedStats.set(modelSeedKey, {
        ...previousModelSeed,
        count: previousModelSeed.count + 1,
        avgScore: updateRunningAverage(previousModelSeed.avgScore, previousModelSeed.count, input.score),
        lastScore: input.score,
        lastUpdatedAt: nowIso,
      })
    }
    scheduleSaveToDisk()
  }

  recentRuns.unshift({
    timestamp: nowIso,
    question: input.question.slice(0, 200),
    variantId: input.variantId,
    variantLabel: input.variantLabel,
    model: input.model,
    seedType: input.seedType,
    score: input.score,
    confidence: input.confidence,
    uncertainty: input.uncertainty,
    latencyMs: input.latencyMs,
    usage: input.usage,
    strengths: input.strengths,
    weaknesses: input.weaknesses,
  })
  if (recentRuns.length > MAX_RECENT_RUNS) {
    recentRuns.length = MAX_RECENT_RUNS
  }
}

export function getEvalStatsSnapshot(variants: PromptVariantDescriptor[]): EvalStatsSnapshot {
  const promptVariants: PromptVariantSnapshot[] = variants.map((variant) => {
    const stat = promptStats.get(variant.id)
    return {
      id: variant.id,
      label: variant.label,
      count: stat?.count ?? 0,
      avgScore: stat?.avgScore ?? 0,
      avgConfidence: stat?.avgConfidence ?? 0,
      avgUncertainty: stat?.avgUncertainty ?? 1,
      avgLatencyMs: stat?.avgLatencyMs ?? 0,
      lastScore: stat?.lastScore ?? null,
      lastUpdatedAt: stat?.lastUpdatedAt ?? null,
    }
  })

  const byOperation = Object.fromEntries(
    Array.from(tokenByOperation.entries()).map(([operation, usage]) => [operation, { ...usage }])
  )

  const modelPerformance = Array.from(modelSeedStats.values()).sort((a, b) => b.avgScore - a.avgScore)

  const topModelBySeedType: Partial<Record<SeedType, string>> = {}
  const groupedBySeed = new Map<SeedType, ModelSeedStat[]>()
  modelPerformance.forEach((entry) => {
    const grouped = groupedBySeed.get(entry.seedType) ?? []
    grouped.push(entry)
    groupedBySeed.set(entry.seedType, grouped)
  })
  groupedBySeed.forEach((entries, seedType) => {
    const top = [...entries].sort((a, b) => b.avgScore - a.avgScore)[0]
    if (top) topModelBySeedType[seedType] = top.model
  })

  return {
    promptVariants,
    recentRuns: [...recentRuns],
    tokenUsage: {
      total: { ...tokenTotals },
      byOperation,
    },
    costGuard: getCostGuardSnapshot(),
    modelPerformance: modelPerformance.map((entry) => ({ ...entry })),
    topModelBySeedType,
  }
}

export function getModelPerformanceSnapshot(): ModelSeedSnapshot[] {
  return Array.from(modelSeedStats.values())
    .sort((a, b) => b.avgScore - a.avgScore)
    .map((entry) => ({ ...entry }))
}
