/**
 * Fractal API Client
 * ==================
 *
 * Client for communicating with the Fractal backend server.
 * Handles question generation via W&B Inference.
 */

import type { StashItem } from '../types/stash'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const DEFAULT_REQUEST_TIMEOUT_MS = 30000

/**
 * Optional request controls for all API calls.
 */
export interface ApiRequestOptions {
  /** Abort signal for caller-driven cancellation. */
  signal?: AbortSignal
  /** Request timeout in milliseconds. Defaults to 30000ms. */
  timeoutMs?: number
}

interface ApiRequestSignalState {
  signal: AbortSignal
  timeoutMs: number
  didTimeout: () => boolean
  cleanup: () => void
}

function createApiRequestSignal(options?: ApiRequestOptions): ApiRequestSignalState {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS
  const controller = new AbortController()
  const cleanupCallbacks: Array<() => void> = []
  let timedOut = false

  if (options?.signal) {
    if (options.signal.aborted) {
      controller.abort(options.signal.reason)
    } else {
      const forwardAbort = () => controller.abort(options.signal?.reason)
      options.signal.addEventListener('abort', forwardAbort, { once: true })
      cleanupCallbacks.push(() => options.signal?.removeEventListener('abort', forwardAbort))
    }
  }

  if (timeoutMs > 0 && Number.isFinite(timeoutMs)) {
    const timeoutId = setTimeout(() => {
      timedOut = true
      controller.abort(new DOMException(`Request timed out after ${timeoutMs}ms`, 'TimeoutError'))
    }, timeoutMs)
    cleanupCallbacks.push(() => clearTimeout(timeoutId))
  }

  return {
    signal: controller.signal,
    timeoutMs,
    didTimeout: () => timedOut,
    cleanup: () => cleanupCallbacks.forEach((fn) => fn()),
  }
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof DOMException
    && (error.name === 'AbortError' || error.name === 'TimeoutError')
  )
}

async function readApiErrorMessage(response: Response, fallbackMessage: string): Promise<string> {
  try {
    const error = (await response.json()) as Partial<ApiError>
    return error.message || error.error || fallbackMessage
  } catch {
    return fallbackMessage
  }
}

async function requestJson<T>(
  path: string,
  init: RequestInit,
  fallbackErrorMessage: string,
  options?: ApiRequestOptions
): Promise<T> {
  const requestState = createApiRequestSignal(options)
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      signal: requestState.signal,
    })

    if (!response.ok) {
      const message = await readApiErrorMessage(response, fallbackErrorMessage)
      throw new Error(message)
    }

    return (await response.json()) as T
  } catch (error) {
    if (requestState.didTimeout()) {
      throw new Error(`Request timed out after ${requestState.timeoutMs}ms`)
    }

    if (isAbortError(error)) {
      throw new Error('Request cancelled')
    }

    throw error instanceof Error ? error : new Error(fallbackErrorMessage)
  } finally {
    requestState.cleanup()
  }
}

/**
 * Response from the generate questions endpoint.
 */
export interface GenerateQuestionsResponse {
  success: boolean
  data: {
    questions: string[]
    model: string
    meta?: {
      promptVariant: string
      promptLabel: string
      qualityScore: number | null
      evalModel: string
      confidence: number | null
      uncertainty: number | null
      strengths: string[]
      weaknesses: string[]
      seedType: string
      costGuard: CostGuardSnapshot
    }
    usage: {
      promptTokens: number
      completionTokens: number
      totalTokens: number
    }
  }
}

/**
 * Error response from the API.
 */
export interface ApiError {
  error: string
  message: string
}

/**
 * Health check response.
 */
export interface HealthResponse {
  status: 'healthy' | 'degraded'
  timestamp: string
  services: {
    inference: 'up' | 'down'
  }
}

/**
 * Response from the models endpoint.
 */
export interface ModelsResponse {
  success: boolean
  data: {
    models: string[]
  }
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

export interface EvalPromptVariantSnapshot {
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

export interface EvalRunRecord {
  timestamp: string
  question: string
  variantId: string
  variantLabel: string
  model: string
  seedType: string
  score: number
  confidence: number | null
  uncertainty: number | null
  latencyMs: number
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  strengths: string[]
  weaknesses: string[]
}

export interface ModelSeedPerformance {
  model: string
  seedType: string
  count: number
  avgScore: number
  lastScore: number | null
  lastUpdatedAt: string | null
}

export interface EvalStatsResponse {
  success: boolean
  data: {
    promptVariants: EvalPromptVariantSnapshot[]
    recentRuns: EvalRunRecord[]
    tokenUsage: {
      total: {
        promptTokens: number
        completionTokens: number
        totalTokens: number
      }
      byOperation: Record<string, {
        promptTokens: number
        completionTokens: number
        totalTokens: number
      }>
    }
    costGuard: CostGuardSnapshot
    modelPerformance: ModelSeedPerformance[]
    topModelBySeedType: Record<string, string>
  }
}

export interface CompareGenerationsResponse {
  success: boolean
  data: {
    question: string
    left: GenerateQuestionsResponse['data']
    right: GenerateQuestionsResponse['data']
    winner: 'left' | 'right' | 'tie'
    reason: string
  }
}

export interface ProbeBrief {
  problemStatement: string
  hypotheses: string[]
  primaryExperiment: string
  successMetrics: string[]
  risks: string[]
  recommendation: string
  nextExperiments: string[]
}

export interface ProbeBriefResponse {
  success: boolean
  data: {
    brief: ProbeBrief
    markdown: string
    model: string
    usage: {
      promptTokens: number
      completionTokens: number
      totalTokens: number
    }
  }
}

export interface ProbeExperimentSuggestion {
  title: string
  hypothesis: string
  metric: string
}

export interface ProbeExperimentSuggestionsResponse {
  success: boolean
  data: {
    suggestions: ProbeExperimentSuggestion[]
    model: string
    usage: {
      promptTokens: number
      completionTokens: number
      totalTokens: number
    }
  }
}

/**
 * Generate related questions for a given input question.
 *
 * @param question - The input question to generate related questions for
 * @param model - Optional model to use (defaults to server's default)
 * @returns Array of related questions
 *
 * @example
 * ```ts
 * const questions = await generateQuestions("What is consciousness?")
 * // ["Is consciousness emergent?", "Can AI be conscious?", ...]
 * ```
 */
export async function generateQuestions(
  question: string,
  model?: string,
  options?: ApiRequestOptions
): Promise<{ questions: string[]; meta: NonNullable<GenerateQuestionsResponse['data']['meta']> | null }> {
  const data = await requestJson<GenerateQuestionsResponse>(
    '/api/generate',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ question, model }),
    },
    'Failed to generate questions',
    options
  )

  return {
    questions: data.data.questions,
    meta: data.data.meta ?? null,
  }
}

export async function compareQuestionGenerations(
  question: string,
  params?: {
    leftModel?: string
    rightModel?: string
    leftPromptVariantId?: string
    rightPromptVariantId?: string
  },
  options?: ApiRequestOptions
): Promise<CompareGenerationsResponse['data']> {
  const data = await requestJson<CompareGenerationsResponse>(
    '/api/generate/compare',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question,
        ...params,
      }),
    },
    'Failed to compare question generations',
    options
  )

  return data.data
}

export async function getEvalStats(options?: ApiRequestOptions): Promise<EvalStatsResponse['data']> {
  const data = await requestJson<EvalStatsResponse>(
    '/api/evals/stats',
    {
      method: 'GET',
    },
    'Failed to fetch eval stats',
    options
  )

  return data.data
}

/**
 * Check the health of the API server.
 */
export async function checkHealth(options?: ApiRequestOptions): Promise<HealthResponse> {
  return requestJson<HealthResponse>(
    '/health',
    {
      method: 'GET',
    },
    'Health check failed',
    options
  )
}

/**
 * Check if the API is available.
 */
export async function isApiAvailable(options?: ApiRequestOptions): Promise<boolean> {
  try {
    const health = await checkHealth(options)
    return health.status === 'healthy'
  } catch {
    return false
  }
}

/**
 * Fetch available models from the backend.
 */
export async function listModels(options?: ApiRequestOptions): Promise<string[]> {
  const data = await requestJson<ModelsResponse>(
    '/api/models',
    {
      method: 'GET',
    },
    'Failed to fetch models',
    options
  )

  return data.data.models
}

export async function getModelPerformance(
  options?: ApiRequestOptions
): Promise<ModelSeedPerformance[]> {
  const data = await requestJson<{
    success: boolean
    data: { entries: ModelSeedPerformance[] }
  }>(
    '/api/models/performance',
    {
      method: 'GET',
    },
    'Failed to fetch model performance',
    options
  )

  return data.data.entries
}

// ============================================
// CHAT API
// ============================================

/**
 * Message in a chat conversation.
 */
export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

/**
 * Response from the chat endpoint.
 */
export interface ChatApiResponse {
  success: boolean
  data: {
    message: string
    model: string
    usage: {
      promptTokens: number
      completionTokens: number
      totalTokens: number
    }
  }
}

/**
 * Send a chat message and get a response.
 *
 * @param rootQuestion - The question being explored (provides context)
 * @param messages - Conversation history
 * @param model - Optional model override
 * @returns The AI response message
 *
 * @example
 * ```ts
 * const response = await sendChatMessage(
 *   "What is consciousness?",
 *   [{ role: 'user', content: 'Can you explain the hard problem?' }]
 * )
 * console.log(response) // "The hard problem of consciousness..."
 * ```
 */
export async function sendChatMessage(
  rootQuestion: string,
  messages: ChatMessage[],
  model?: string,
  options?: ApiRequestOptions
): Promise<string> {
  const data = await requestJson<ChatApiResponse>(
    '/api/chat',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ rootQuestion, messages, model }),
    },
    'Failed to send chat message',
    options
  )

  return data.data.message
}

// ============================================
// CONCEPT EXTRACTION API
// ============================================

/**
 * Valid concept categories for classification.
 */
export type ConceptCategory =
  | 'science'
  | 'philosophy'
  | 'psychology'
  | 'technology'
  | 'abstract'

/**
 * An extracted concept with position and metadata.
 */
export interface ExtractedConcept {
  id: string
  text: string
  normalizedName: string
  category: ConceptCategory
  startIndex: number
  endIndex: number
}

/**
 * Response from the concept extraction endpoint.
 */
export interface ConceptExtractionResponse {
  success: boolean
  data: {
    concepts: ExtractedConcept[]
    sourceText: string
  }
}

/**
 * Explanation for a concept.
 */
export interface ConceptExplanation {
  conceptId: string
  normalizedName: string
  summary: string
  context: string
  relatedConcepts: string[]
}

/**
 * Response from the concept explanation endpoint.
 */
export interface ConceptExplanationResponse {
  success: boolean
  data: ConceptExplanation
}

/**
 * Extract key concepts from question text.
 *
 * @param text - The text to extract concepts from
 * @param model - Optional model override
 * @returns Array of extracted concepts with positions and metadata
 *
 * @example
 * ```ts
 * const concepts = await extractConcepts("Why do we dream during sleep?")
 * // [
 * //   { text: 'dream', normalizedName: 'dreams', category: 'psychology', ... },
 * //   { text: 'sleep', normalizedName: 'sleep', category: 'science', ... }
 * // ]
 * ```
 */
export async function extractConcepts(
  text: string,
  model?: string,
  options?: ApiRequestOptions
): Promise<ExtractedConcept[]> {
  const data = await requestJson<ConceptExtractionResponse>(
    '/api/concepts/extract',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text, model }),
    },
    'Failed to extract concepts',
    options
  )

  return data.data.concepts
}

// ============================================
// PROBE CHAT API
// ============================================

/**
 * Send a probe chat message with stash items as context.
 *
 * @param messages - Conversation history
 * @param stashItems - Selected stash items for context
 * @param model - Optional model override
 * @returns The AI response message
 *
 * @example
 * ```ts
 * const response = await sendProbeChatMessage(
 *   [{ role: 'user', content: 'Synthesize these insights...' }],
 *   selectedStashItems
 * )
 * ```
 */
export async function sendProbeChatMessage(
  messages: ChatMessage[],
  stashItems: StashItem[],
  model?: string,
  options?: ApiRequestOptions
): Promise<string> {
  const data = await requestJson<ChatApiResponse>(
    '/api/probe/chat',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages, stashItems, model }),
    },
    'Failed to send probe message',
    options
  )

  return data.data.message
}

export async function exportProbeBrief(
  stashItems: StashItem[],
  direction: string,
  model?: string,
  options?: ApiRequestOptions
): Promise<ProbeBriefResponse['data']> {
  const data = await requestJson<ProbeBriefResponse>(
    '/api/probe/brief',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        stashItems,
        direction,
        model,
      }),
    },
    'Failed to export probe brief',
    options
  )

  return data.data
}

export async function suggestProbeExperiments(
  messages: ChatMessage[],
  stashItems: StashItem[],
  model?: string,
  options?: ApiRequestOptions
): Promise<ProbeExperimentSuggestionsResponse['data']> {
  const data = await requestJson<ProbeExperimentSuggestionsResponse>(
    '/api/probe/experiments',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages,
        stashItems,
        model,
      }),
    },
    'Failed to suggest probe experiments',
    options
  )

  return data.data
}

/**
 * Get an explanation for a concept in context.
 *
 * @param conceptId - ID of the concept
 * @param conceptName - The normalized name of the concept
 * @param questionContext - The question context for the concept
 * @param model - Optional model override
 * @returns Explanation with summary, context, and related concepts
 *
 * @example
 * ```ts
 * const explanation = await explainConcept(
 *   'c_123',
 *   'dreams',
 *   'Why do we dream during sleep?'
 * )
 * console.log(explanation.summary)
 * // "Dreams are mental experiences during sleep..."
 * ```
 */
export async function explainConcept(
  conceptId: string,
  conceptName: string,
  questionContext: string,
  model?: string,
  options?: ApiRequestOptions
): Promise<ConceptExplanation> {
  const data = await requestJson<ConceptExplanationResponse>(
    '/api/concepts/explain',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ conceptId, conceptName, questionContext, model }),
    },
    'Failed to explain concept',
    options
  )

  return data.data
}
