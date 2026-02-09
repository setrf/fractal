/**
 * @fileoverview View mode management hook for traditional/graph view switching.
 *
 * Features:
 * - Two modes: 'traditional' (tree view) and 'graph' (3D knowledge graph)
 * - Persists user preference to localStorage
 * - Applies view mode via data-view-mode attribute on document root
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { viewMode, toggleViewMode } = useViewMode()
 *   return (
 *     <button onClick={toggleViewMode}>
 *       Current: {viewMode}
 *     </button>
 *   )
 * }
 * ```
 */

import { useState, useEffect, useCallback } from 'react'
import { type ViewMode, GRAPH_VIEW_STORAGE_KEY, DEFAULT_VIEW_MODE, isValidViewMode } from '../types/graph'

/**
 * Retrieves the stored view mode preference from localStorage.
 *
 * Falls back to 'traditional' if no valid preference is stored.
 *
 * @returns The stored view mode or 'traditional' as default
 */
function getStoredViewMode(): ViewMode {
  // SSR safety check
  if (typeof window === 'undefined') return DEFAULT_VIEW_MODE

  try {
    const stored = localStorage.getItem(GRAPH_VIEW_STORAGE_KEY)

    // Validate stored value is a valid view mode
    if (isValidViewMode(stored)) {
      return stored
    }
  } catch {
    return DEFAULT_VIEW_MODE
  }

  return DEFAULT_VIEW_MODE
}

/**
 * Applies the view mode to the document by setting the data-view-mode attribute.
 *
 * @param mode - The view mode to apply
 */
function applyViewMode(mode: ViewMode) {
  const root = document.documentElement
  root.setAttribute('data-view-mode', mode)
}

/**
 * Return type for the useViewMode hook.
 */
export interface UseViewModeReturn {
  /** Current view mode ('traditional' or 'graph') */
  viewMode: ViewMode
  /** Set a specific view mode */
  setViewMode: (mode: ViewMode) => void
  /** Toggle between traditional and graph views */
  toggleViewMode: () => void
  /** Whether currently in graph view */
  isGraphView: boolean
}

/**
 * Hook for managing application view mode (traditional tree vs 3D graph).
 *
 * Provides:
 * - `viewMode`: The current view mode setting
 * - `setViewMode`: Set a specific view mode
 * - `toggleViewMode`: Toggle between traditional and graph
 * - `isGraphView`: Boolean for quick checks
 *
 * @returns View mode state and control functions
 *
 * @example
 * ```tsx
 * function ViewModeToggle() {
 *   const { viewMode, toggleViewMode, isGraphView } = useViewMode()
 *
 *   return (
 *     <button onClick={toggleViewMode}>
 *       {isGraphView ? '🌳' : '🔮'}
 *     </button>
 *   )
 * }
 * ```
 */
export function useViewMode(): UseViewModeReturn {
  // Initialize from localStorage (or 'traditional' default)
  const [viewMode, setViewModeState] = useState<ViewMode>(getStoredViewMode)

  /**
   * Updates the view mode, persists to localStorage, and applies to DOM.
   */
  const setViewMode = useCallback((newMode: ViewMode) => {
    setViewModeState(newMode)
    try {
      localStorage.setItem(GRAPH_VIEW_STORAGE_KEY, newMode)
    } catch {
      // Ignore storage errors (private mode/quota)
    }
    applyViewMode(newMode)
  }, [])

  /**
   * Toggles between traditional and graph modes.
   */
  const toggleViewMode = useCallback(() => {
    const newMode = viewMode === 'traditional' ? 'graph' : 'traditional'
    setViewMode(newMode)
  }, [viewMode, setViewMode])

  // Apply view mode on initial mount
  useEffect(() => {
    applyViewMode(viewMode)
  }, [viewMode])

  return {
    viewMode,
    setViewMode,
    toggleViewMode,
    isGraphView: viewMode === 'graph',
  }
}
