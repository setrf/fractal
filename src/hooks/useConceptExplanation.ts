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
function hashString(value: string): string {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0
  }
  return hash.toString(36)
}

function getCacheKey(conceptName: string, questionContext: string, model?: string): string {
  const normalizedContext = questionContext.trim().toLowerCase()
  const contextHash = hashString(normalizedContext)
  const conceptKey = conceptName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  const modelKey = (model || 'default')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
  return `${CACHE_KEY_PREFIX}${conceptKey}_${contextHash}_${modelKey}`
}

function getRequestScopeKey(
  conceptId: string,
  conceptName: string,
  questionContext: string,
  model?: string
): string {
  const contextHash = hashString(questionContext.trim().toLowerCase())
  const conceptKey = conceptName.toLowerCase().trim()
  const modelKey = (model || 'default').toLowerCase().trim()
  return `${conceptId}::${conceptKey}::${contextHash}::${modelKey}`
}

/**
 * Get cached explanation from localStorage.
 * Returns null if not cached or expired.
 */
function getCachedExplanation(
  conceptName: string,
  questionContext: string,
  model?: string
): ConceptExplanation | null {
  try {
    const key = getCacheKey(conceptName, questionContext, model)
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
  explanation: ConceptExplanation,
  model?: string
): void {
  try {
    const key = getCacheKey(conceptName, questionContext, model)
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
 * Loading state for a specific concept.
 */
export interface ConceptLoadingState {
  isLoading: boolean
  error: string | null
}

/**
 * State returned by the useConceptExplanation hook.
 */
export interface UseConceptExplanationState {
  /** Map of concept IDs to their explanations */
  explanations: Record<string, ConceptExplanation>
  /** Map of concept IDs to their loading states */
  loadingStates: Record<string, ConceptLoadingState>
  /** Legacy: Current explanation being displayed (last fetched) */
  explanation: ConceptExplanation | null
  /** Legacy: True when fetching an explanation */
  isLoading: boolean
  /** Legacy: Error message if fetch failed */
  error: string | null
  /** Legacy: The concept ID being explained */
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
    questionContext: string,
    model?: string
  ) => Promise<ConceptExplanation | null>
  /** Get explanation for a specific concept ID */
  getExplanation: (conceptId: string) => ConceptExplanation | null
  /** Get loading state for a specific concept ID */
  getLoadingState: (conceptId: string) => ConceptLoadingState
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
 * - Supports multiple simultaneous explanations for multiple popups
 * - localStorage caching with 24-hour expiration
 * - Loading state management per concept
 * - Error handling per concept
 * - Request deduplication
 */
export function useConceptExplanation(): UseConceptExplanationReturn {
  // Multiple explanations keyed by concept ID
  const [explanations, setExplanations] = useState<Record<string, ConceptExplanation>>({})
  const [loadingStates, setLoadingStates] = useState<Record<string, ConceptLoadingState>>({})
  
  // Legacy single-explanation state for backwards compatibility
  const [explanation, setExplanation] = useState<ConceptExplanation | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentConceptId, setCurrentConceptId] = useState<string | null>(null)
  
  // Track in-flight requests to prevent duplicates
  const pendingRequests = useRef<Set<string>>(new Set())
  // Tracks the request scope that produced the current explanation for a conceptId.
  // This avoids reusing stale explanations when context/model changes.
  const scopeByConceptId = useRef<Map<string, string>>(new Map())
  // Tracks the most recently requested scope for each concept.
  // Older in-flight requests must not overwrite newer results.
  const latestRequestedScopeByConceptId = useRef<Map<string, string>>(new Map())

  /**
   * Get explanation for a specific concept ID.
   */
  const getExplanation = useCallback((conceptId: string): ConceptExplanation | null => {
    return explanations[conceptId] || null
  }, [explanations])

  /**
   * Get loading state for a specific concept ID.
   */
  const getLoadingState = useCallback((conceptId: string): ConceptLoadingState => {
    return loadingStates[conceptId] || { isLoading: false, error: null }
  }, [loadingStates])

  /**
   * Fetch explanation for a concept.
   * Returns cached result if available.
   * Supports fetching multiple explanations simultaneously.
   */
  const fetchExplanation = useCallback(async (
    conceptId: string,
    conceptName: string,
    questionContext: string,
    model?: string
  ): Promise<ConceptExplanation | null> => {
    const requestScopeKey = getRequestScopeKey(conceptId, conceptName, questionContext, model)
    const isLatestScope = () => (
      latestRequestedScopeByConceptId.current.get(conceptId) === requestScopeKey
    )

    // Check if we already have this explanation
    const existing = explanations[conceptId]
    if (existing && scopeByConceptId.current.get(conceptId) === requestScopeKey) {
      latestRequestedScopeByConceptId.current.set(conceptId, requestScopeKey)
      // Update legacy state too
      setExplanation(existing)
      setCurrentConceptId(conceptId)
      setError(null)
      return existing
    }

    // Check cache
    const cached = getCachedExplanation(conceptName, questionContext, model)
    if (cached) {
      latestRequestedScopeByConceptId.current.set(conceptId, requestScopeKey)
      // Update the conceptId in case it changed
      const updatedCached = { ...cached, conceptId }
      setExplanations(prev => ({ ...prev, [conceptId]: updatedCached }))
      scopeByConceptId.current.set(conceptId, requestScopeKey)
      // Update legacy state too
      setExplanation(updatedCached)
      setCurrentConceptId(conceptId)
      setError(null)
      return updatedCached
    }

    // Prevent duplicate requests
    if (pendingRequests.current.has(requestScopeKey)) {
      return null
    }

    try {
      latestRequestedScopeByConceptId.current.set(conceptId, requestScopeKey)
      // Set loading state for this concept
      setLoadingStates(prev => ({
        ...prev,
        [conceptId]: { isLoading: true, error: null }
      }))
      // Legacy state
      setIsLoading(true)
      setError(null)
      setCurrentConceptId(conceptId)
      pendingRequests.current.add(requestScopeKey)

      const result = await explainConceptApi(conceptId, conceptName, questionContext, model)

      if (!isLatestScope()) {
        return null
      }
      
      // Cache the result
      setCachedExplanation(conceptName, questionContext, result, model)
      
      // Update explanations map
      setExplanations(prev => ({ ...prev, [conceptId]: result }))
      scopeByConceptId.current.set(conceptId, requestScopeKey)
      setLoadingStates(prev => ({
        ...prev,
        [conceptId]: { isLoading: false, error: null }
      }))
      
      // Legacy state
      setExplanation(result)
      
      return result
    } catch (err) {
      if (!isLatestScope()) {
        return null
      }
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch explanation'
      setLoadingStates(prev => ({
        ...prev,
        [conceptId]: { isLoading: false, error: errorMessage }
      }))
      // Legacy state
      setError(errorMessage)
      setExplanation(null)
      return null
    } finally {
      if (isLatestScope()) {
        setIsLoading(false)
      }
      pendingRequests.current.delete(requestScopeKey)
    }
  }, [explanations])

  /**
   * Clear all explanations and error states.
   */
  const reset = useCallback(() => {
    setExplanations({})
    setLoadingStates({})
    setExplanation(null)
    setError(null)
    setCurrentConceptId(null)
    pendingRequests.current.clear()
    scopeByConceptId.current.clear()
    latestRequestedScopeByConceptId.current.clear()
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
    // New multi-explanation support
    explanations,
    loadingStates,
    getExplanation,
    getLoadingState,
    // Legacy single-explanation support
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
  questionContext: string,
  model?: string
): boolean {
  return getCachedExplanation(conceptName, questionContext, model) !== null
}
