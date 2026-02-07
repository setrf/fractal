/**
 * useConceptExtraction Hook
 * =========================
 * 
 * React hook for extracting concepts from question text.
 * Handles API calls, loading states, error handling, and caching.
 * 
 * @example
 * ```tsx
 * const { concepts, isLoading, error, extract } = useConceptExtraction()
 * 
 * // Extract concepts from a question
 * await extract("Why do we dream during sleep?")
 * 
 * // Concepts are now available
 * concepts.forEach(c => console.log(c.text, c.category))
 * ```
 */

import { useState, useCallback, useRef } from 'react'
import { extractConcepts as extractConceptsApi, type ExtractedConcept } from '../api'

/**
 * Cache for extracted concepts to avoid redundant API calls.
 * Key is the source text, value is the extracted concepts.
 */
const conceptCache = new Map<string, ExtractedConcept[]>()

function getCacheKey(text: string, model?: string): string {
  const normalizedText = text.trim()
  const modelKey = model?.trim() || 'default'
  return `${modelKey}::${normalizedText}`
}

/**
 * State returned by the useConceptExtraction hook.
 */
export interface UseConceptExtractionState {
  /** Extracted concepts for the current text */
  concepts: ExtractedConcept[]
  /** True when an extraction is in progress */
  isLoading: boolean
  /** Error message if extraction failed */
  error: string | null
  /** The source text that concepts were extracted from */
  sourceText: string | null
}

/**
 * Actions returned by the useConceptExtraction hook.
 */
export interface UseConceptExtractionActions {
  /** Extract concepts from the given text */
  extract: (text: string, model?: string) => Promise<ExtractedConcept[]>
  /** Clear the current concepts and error */
  reset: () => void
  /** Clear the entire concept cache */
  clearCache: () => void
}

/**
 * Combined return type for useConceptExtraction.
 */
export type UseConceptExtractionReturn = UseConceptExtractionState & UseConceptExtractionActions

/**
 * Hook for extracting concepts from question text.
 * 
 * Features:
 * - Automatic caching of results per text
 * - Loading state management
 * - Error handling with descriptive messages
 * - Request deduplication (prevents multiple calls for same text)
 */
export function useConceptExtraction(): UseConceptExtractionReturn {
  const [concepts, setConcepts] = useState<ExtractedConcept[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sourceText, setSourceText] = useState<string | null>(null)
  
  // Track in-flight requests by cache key to prevent duplicates.
  const pendingRequests = useRef<Set<string>>(new Set())
  // Only the latest extraction request should update hook state.
  const latestRequestId = useRef(0)

  /**
   * Extract concepts from the given text.
   * Returns cached results if available.
   */
  const extract = useCallback(async (text: string, model?: string): Promise<ExtractedConcept[]> => {
    // Normalize text for caching
    const normalizedText = text.trim()
    const cacheKey = getCacheKey(normalizedText, model)
    
    if (!normalizedText) {
      setConcepts([])
      setSourceText(null)
      setError(null)
      return []
    }

    // Check cache first
    const cached = conceptCache.get(cacheKey)
    if (cached) {
      setConcepts(cached)
      setSourceText(normalizedText)
      setError(null)
      return cached
    }

    // Prevent duplicate requests
    if (pendingRequests.current.has(cacheKey)) {
      // Request already in progress for this text
      return []
    }

    const requestId = latestRequestId.current + 1
    latestRequestId.current = requestId

    try {
      setIsLoading(true)
      setError(null)
      pendingRequests.current.add(cacheKey)

      const result = await extractConceptsApi(normalizedText, model)
      
      // Cache the result
      conceptCache.set(cacheKey, result)

      if (latestRequestId.current === requestId) {
        setConcepts(result)
        setSourceText(normalizedText)
      }
      
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to extract concepts'
      if (latestRequestId.current === requestId) {
        setError(errorMessage)
        setConcepts([])
      }
      return []
    } finally {
      if (pendingRequests.current.has(cacheKey)) {
        pendingRequests.current.delete(cacheKey)
      }
      if (latestRequestId.current === requestId || pendingRequests.current.size === 0) {
        setIsLoading(false)
      }
    }
  }, [])

  /**
   * Clear current concepts and error state.
   */
  const reset = useCallback(() => {
    setConcepts([])
    setError(null)
    setSourceText(null)
    pendingRequests.current.clear()
    latestRequestId.current = 0
  }, [])

  /**
   * Clear the entire concept cache.
   * Useful for testing or when data freshness is required.
   */
  const clearCache = useCallback(() => {
    conceptCache.clear()
  }, [])

  return {
    concepts,
    isLoading,
    error,
    sourceText,
    extract,
    reset,
    clearCache,
  }
}

/**
 * Get cached concepts for a text without triggering an API call.
 * Returns undefined if not cached.
 */
export function getCachedConcepts(text: string, model?: string): ExtractedConcept[] | undefined {
  return conceptCache.get(getCacheKey(text, model))
}

/**
 * Check if concepts are cached for the given text.
 */
export function hasCachedConcepts(text: string, model?: string): boolean {
  return conceptCache.has(getCacheKey(text, model))
}
