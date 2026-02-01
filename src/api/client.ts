/**
 * Fractal API Client
 * ==================
 * 
 * Client for communicating with the Fractal backend server.
 * Handles question generation via W&B Inference.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

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
  model?: string
): Promise<{ questions: string[]; meta: GenerateQuestionsResponse['data']['meta'] | null }> {
  const response = await fetch(`${API_BASE_URL}/api/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ question, model }),
  })

  if (!response.ok) {
    const error: ApiError = await response.json()
    throw new Error(error.message || 'Failed to generate questions')
  }

  const data: GenerateQuestionsResponse = await response.json()
  return {
    questions: data.data.questions,
    meta: data.data.meta ?? null,
  }
}

/**
 * Check the health of the API server.
 */
export async function checkHealth(): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE_URL}/health`)
  
  if (!response.ok) {
    throw new Error('Health check failed')
  }

  return response.json()
}

/**
 * Check if the API is available.
 */
export async function isApiAvailable(): Promise<boolean> {
  try {
    const health = await checkHealth()
    return health.status === 'healthy'
  } catch {
    return false
  }
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
  model?: string
): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ rootQuestion, messages, model }),
  })

  if (!response.ok) {
    const error: ApiError = await response.json()
    throw new Error(error.message || 'Failed to send chat message')
  }

  const data: ChatApiResponse = await response.json()
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
  model?: string
): Promise<ExtractedConcept[]> {
  const response = await fetch(`${API_BASE_URL}/api/concepts/extract`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text, model }),
  })

  if (!response.ok) {
    const error: ApiError = await response.json()
    throw new Error(error.message || 'Failed to extract concepts')
  }

  const data: ConceptExtractionResponse = await response.json()
  return data.data.concepts
}

// ============================================
// PROBE CHAT API
// ============================================

import type { StashItem } from '../types/stash'

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
  model?: string
): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/api/probe/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messages, stashItems, model }),
  })

  if (!response.ok) {
    const error: ApiError = await response.json()
    throw new Error(error.message || 'Failed to send probe message')
  }

  const data: ChatApiResponse = await response.json()
  return data.data.message
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
  model?: string
): Promise<ConceptExplanation> {
  const response = await fetch(`${API_BASE_URL}/api/concepts/explain`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ conceptId, conceptName, questionContext, model }),
  })

  if (!response.ok) {
    const error: ApiError = await response.json()
    throw new Error(error.message || 'Failed to explain concept')
  }

  const data: ConceptExplanationResponse = await response.json()
  return data.data
}
