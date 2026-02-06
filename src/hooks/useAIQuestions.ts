/**
 * useAIQuestions Hook
 * ===================
 * 
 * Hook for generating AI-powered related questions.
 * 
 * Uses the Fractal backend which connects to:
 * - W&B Inference for LLM calls
 * - W&B Weave for tracing and observability
 */

import { useState, useCallback } from 'react'
import { generateQuestions, isApiAvailable, type GenerateQuestionsResponse } from '../api'

const isTestMode = import.meta.env.MODE === 'test'

interface UseAIQuestionsResult {
  /** Generate related questions for a given question */
  generate: (question: string, model?: string) => Promise<{
    questions: string[]
    meta: NonNullable<GenerateQuestionsResponse['data']['meta']> | null
  }>
  /** Whether a generation is in progress */
  isLoading: boolean
  /** Error from the last generation attempt */
  error: string | null
  /** Metadata from the last generation */
  lastMeta: NonNullable<GenerateQuestionsResponse['data']['meta']> | null
  /** Whether the AI service is available */
  isAvailable: boolean
  /** Check if the AI service is available */
  checkAvailability: () => Promise<boolean>
}

/**
 * Hook for generating AI-powered related questions.
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { generate, isLoading, error } = useAIQuestions()
 *   
 *   const handleGenerate = async () => {
 *     const { questions, meta } = await generate("What is consciousness?")
 *     console.log(questions, meta)
 *   }
 *   
 *   return (
 *     <button onClick={handleGenerate} disabled={isLoading}>
 *       {isLoading ? 'Generating...' : 'Generate Questions'}
 *     </button>
 *   )
 * }
 * ```
 */
export function useAIQuestions(): UseAIQuestionsResult {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isAvailable, setIsAvailable] = useState(true)
  const [lastMeta, setLastMeta] = useState<NonNullable<GenerateQuestionsResponse['data']['meta']> | null>(null)

  const checkAvailability = useCallback(async () => {
    const available = await isApiAvailable()
    setIsAvailable(available)
    return available
  }, [])

  const generate = useCallback(async (question: string, model?: string): Promise<{
    questions: string[]
    meta: NonNullable<GenerateQuestionsResponse['data']['meta']> | null
  }> => {
    setIsLoading(true)
    setError(null)

    try {
      console.log(`[AI] Generating questions for: "${question}"`)
      const { questions, meta } = await generateQuestions(question, model)
      setLastMeta(meta)
      console.log(`[AI] Generated ${questions.length} questions`)
      return { questions, meta }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      if (!isTestMode) {
        console.error('[AI] Generation failed:', errorMessage)
      }
      setError(errorMessage)
      setIsAvailable(false)
      return { questions: [], meta: null }
    } finally {
      setIsLoading(false)
    }
  }, [])

  return {
    generate,
    isLoading,
    error,
    lastMeta,
    isAvailable,
    checkAvailability,
  }
}
