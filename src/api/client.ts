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
): Promise<string[]> {
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
  return data.data.questions
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
