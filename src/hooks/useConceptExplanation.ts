/**
 * useConceptExplanation Hook
 * ==========================
 * 
 * React hook for fetching concept explanations with localStorage caching.
 * Provides on-demand LLM-generated explanations for concepts within
 * the context of a specific question.
 * 
 * @example
 * ```tsx
 * const { explanation, isLoading, error, fetchExplanation } = useConceptExplanation()
 * 
 * // Fetch explanation when user hovers on a concept
 * await fetchExplanation('c_123', 'dreams', 'Why do we dream?')
 * 
 * // Show the explanation
 * console.log(explanation?.summary)
 * ```
 */

import { useState, useCallback, useRef } from 'react'
import { explainConcept as explainConceptApi, type ConceptExplanation } from '../api'

/**
 * localStorage key prefix for cached explanations.
 */
const CACHE_KEY_PREFIX = 'fractal_concept_explanation_'

/**
 * Cache expiration time in milliseconds (24 hours).
 */
const CACHE_EXPIRATION_MS = 24 * 60 * 60 * 1000

/**
 * Cached explanation with timestamp for expiration.
 */
interface CachedExplanation {
  explanation: ConceptExplanation
  timestamp: number
}

/**
 * Generate cache key for a concept explanation.
 * Key is based on normalized name + question context to allow
 * different explanations for the same concept in different contexts.
 */
function getCacheKey(conceptName: string, questionContext: string): string {
  // Create a simple hash of the context to keep key manageable
  const contextHash = questionContext
    .toLowerCase()
    .slice(0, 50)
    .replace(/[^a-z0-9]/g, '')
  
  return `${CACHE_KEY_PREFIX}${conceptName.toLowerCase()}_${contextHash}`
}

/**
 * Get cached explanation from localStorage.
 * Returns null if not cached or expired.
 */
function getCachedExplanation(
  conceptName: string,
  questionContext: string
): ConceptExplanation | null {
  try {
    const key = getCacheKey(conceptName, questionContext)
    const cached = localStorage.getItem(key)
    
    if (!cached) return null
    
    const parsed: CachedExplanation = JSON.parse(cached)
    
    // Check expiration
    if (Date.now() - parsed.timestamp > CACHE_EXPIRATION_MS) {
      localStorage.removeItem(key)
      return null
    }
    
    return parsed.explanation
  } catch {
    return null
  }
}

/**
 * Save explanation to localStorage cache.
 */
function setCachedExplanation(
  conceptName: string,
  questionContext: string,
  explanation: ConceptExplanation
): void {
  try {
    const key = getCacheKey(conceptName, questionContext)
    const cached: CachedExplanation = {
      explanation,
      timestamp: Date.now(),
    }
    localStorage.setItem(key, JSON.stringify(cached))
  } catch {
    // Ignore localStorage errors (quota exceeded, etc.)
    console.warn('[useConceptExplanation] Failed to cache explanation')
  }
}

/**
 * State returned by the useConceptExplanation hook.
 */
export interface UseConceptExplanationState {
  /** Current explanation being displayed */
  explanation: ConceptExplanation | null
  /** True when fetching an explanation */
  isLoading: boolean
  /** Error message if fetch failed */
  error: string | null
  /** The concept ID being explained */
  currentConceptId: string | null
}

/**
 * Actions returned by the useConceptExplanation hook.
 */
export interface UseConceptExplanationActions {
  /** Fetch explanation for a concept */
  fetchExplanation: (
    conceptId: string,
    conceptName: string,
    questionContext: string
  ) => Promise<ConceptExplanation | null>
  /** Clear the current explanation */
  reset: () => void
  /** Clear all cached explanations from localStorage */
  clearAllCached: () => void
}

/**
 * Combined return type for useConceptExplanation.
 */
export type UseConceptExplanationReturn = UseConceptExplanationState & UseConceptExplanationActions

/**
 * Hook for fetching concept explanations.
 * 
 * Features:
 * - localStorage caching with 24-hour expiration
 * - Loading state management
 * - Error handling
 * - Request deduplication
 */
export function useConceptExplanation(): UseConceptExplanationReturn {
  const [explanation, setExplanation] = useState<ConceptExplanation | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentConceptId, setCurrentConceptId] = useState<string | null>(null)
  
  // Track in-flight requests to prevent duplicates
  const pendingRequest = useRef<string | null>(null)

  /**
   * Fetch explanation for a concept.
   * Returns cached result if available.
   */
  const fetchExplanation = useCallback(async (
    conceptId: string,
    conceptName: string,
    questionContext: string
  ): Promise<ConceptExplanation | null> => {
    // Check cache first
    const cached = getCachedExplanation(conceptName, questionContext)
    if (cached) {
      // Update the conceptId in case it changed
      const updatedCached = { ...cached, conceptId }
      setExplanation(updatedCached)
      setCurrentConceptId(conceptId)
      setError(null)
      return updatedCached
    }

    // Prevent duplicate requests
    const requestKey = `${conceptId}_${conceptName}`
    if (pendingRequest.current === requestKey) {
      return null
    }

    try {
      setIsLoading(true)
      setError(null)
      setCurrentConceptId(conceptId)
      pendingRequest.current = requestKey

      const result = await explainConceptApi(conceptId, conceptName, questionContext)
      
      // Cache the result
      setCachedExplanation(conceptName, questionContext, result)
      
      setExplanation(result)
      
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch explanation'
      setError(errorMessage)
      setExplanation(null)
      return null
    } finally {
      setIsLoading(false)
      pendingRequest.current = null
    }
  }, [])

  /**
   * Clear current explanation and error state.
   */
  const reset = useCallback(() => {
    setExplanation(null)
    setError(null)
    setCurrentConceptId(null)
    pendingRequest.current = null
  }, [])

  /**
   * Clear all cached explanations from localStorage.
   */
  const clearAllCached = useCallback(() => {
    try {
      const keysToRemove: string[] = []
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key?.startsWith(CACHE_KEY_PREFIX)) {
          keysToRemove.push(key)
        }
      }
      
      keysToRemove.forEach(key => localStorage.removeItem(key))
    } catch {
      console.warn('[useConceptExplanation] Failed to clear cache')
    }
  }, [])

  return {
    explanation,
    isLoading,
    error,
    currentConceptId,
    fetchExplanation,
    reset,
    clearAllCached,
  }
}

/**
 * Check if an explanation is cached for the given concept and context.
 */
export function hasExplanationCached(
  conceptName: string,
  questionContext: string
): boolean {
  return getCachedExplanation(conceptName, questionContext) !== null
}
