/**
 * useModelSelection Hook
 * ======================
 *
 * Fetches available models and persists the user's selection.
 */

import { useState, useCallback, useEffect } from 'react'
import { listModels } from '../api'

const STORAGE_KEY = 'fractal_selected_model'

function getStoredModel(): string | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored && stored.trim() ? stored : null
  } catch {
    return null
  }
}

function persistModel(model: string | null): void {
  try {
    if (model) {
      localStorage.setItem(STORAGE_KEY, model)
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    // Ignore storage errors
  }
}

export interface UseModelSelectionReturn {
  models: string[]
  selectedModel: string | null
  setSelectedModel: (model: string | null) => void
  isLoading: boolean
  error: string | null
  refreshModels: () => Promise<void>
}

export function useModelSelection(): UseModelSelectionReturn {
  const [models, setModels] = useState<string[]>([])
  const [selectedModel, setSelectedModelState] = useState<string | null>(() => getStoredModel())
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setSelectedModel = useCallback((model: string | null) => {
    const trimmed = model?.trim() || null
    setSelectedModelState(trimmed)
    persistModel(trimmed)
  }, [])

  const refreshModels = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await listModels()
      const uniqueModels = Array.from(new Set(response)).sort((a, b) => a.localeCompare(b))
      setModels(uniqueModels)
      setSelectedModelState((prev) => {
        if (!prev) return null
        if (uniqueModels.includes(prev)) return prev
        persistModel(null)
        return null
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch models'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshModels()
  }, [refreshModels])

  return {
    models,
    selectedModel,
    setSelectedModel,
    isLoading,
    error,
    refreshModels,
  }
}
