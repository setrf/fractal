/**
 * @fileoverview Theme management hook for light/dark mode support.
 * 
 * Features:
 * - Three modes: 'light', 'dark', and 'system' (follows OS preference)
 * - Persists user preference to localStorage
 * - Applies theme via data-theme attribute on document root
 * - Reactively updates when system preference changes
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { effectiveTheme, toggleTheme } = useTheme()
 *   return (
 *     <button onClick={toggleTheme}>
 *       Current: {effectiveTheme}
 *     </button>
 *   )
 * }
 * ```
 */

import { useState, useEffect, useCallback } from 'react'

/** Available theme modes */
type Theme = 'light' | 'dark' | 'system'

/** localStorage key for persisting theme preference */
const STORAGE_KEY = 'fractal-theme'

/**
 * Detects the current system color scheme preference.
 * 
 * @returns 'dark' if system prefers dark mode, 'light' otherwise
 */
function getSystemTheme(): 'light' | 'dark' {
  // SSR safety check
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/**
 * Retrieves the stored theme preference from localStorage.
 * 
 * Falls back to 'system' if no valid preference is stored.
 * 
 * @returns The stored theme or 'system' as default
 */
function getStoredTheme(): Theme {
  // SSR safety check
  if (typeof window === 'undefined') return 'system'

  try {
    const stored = localStorage.getItem(STORAGE_KEY)

    // Validate stored value is a valid theme
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored
    }
  } catch {
    return 'system'
  }

  return 'system'
}

/**
 * Applies the theme to the document by setting the data-theme attribute.
 * 
 * When theme is 'system', removes the attribute to let CSS media queries
 * handle the styling. Otherwise, sets data-theme to the explicit theme.
 * 
 * @param theme - The theme to apply
 */
function applyTheme(theme: Theme) {
  const root = document.documentElement
  const effectiveTheme = theme === 'system' ? getSystemTheme() : theme
  
  if (theme === 'system') {
    // Remove attribute to let @media (prefers-color-scheme) take over
    root.removeAttribute('data-theme')
  } else {
    // Set explicit theme override
    root.setAttribute('data-theme', effectiveTheme)
  }
}

/**
 * Hook for managing application theme (light/dark mode).
 * 
 * Provides:
 * - `theme`: The current setting ('light', 'dark', or 'system')
 * - `effectiveTheme`: The actual applied theme ('light' or 'dark')
 * - `setTheme`: Set a specific theme
 * - `toggleTheme`: Toggle between light and dark
 * - `isSystem`: Whether using system preference
 * 
 * @returns Theme state and control functions
 * 
 * @example
 * ```tsx
 * function ThemeToggle() {
 *   const { effectiveTheme, toggleTheme, isSystem } = useTheme()
 *   
 *   return (
 *     <div>
 *       <button onClick={toggleTheme}>
 *         {effectiveTheme === 'light' ? '🌙' : '☀️'}
 *       </button>
 *       {isSystem && <span>Using system preference</span>}
 *     </div>
 *   )
 * }
 * ```
 */
export function useTheme() {
  // Initialize from localStorage (or 'system' default)
  const [theme, setThemeState] = useState<Theme>(getStoredTheme)
  
  /**
   * Updates the theme, persists to localStorage, and applies to DOM.
   */
  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme)
    try {
      localStorage.setItem(STORAGE_KEY, newTheme)
    } catch {
      // Ignore storage errors (private mode/quota)
    }
    applyTheme(newTheme)
  }, [])
  
  /**
   * Toggles between light and dark modes.
   * If currently using the effective light theme, switches to dark, and vice versa.
   */
  const toggleTheme = useCallback(() => {
    const currentEffective = theme === 'system' ? getSystemTheme() : theme
    const newTheme = currentEffective === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
  }, [theme, setTheme])
  
  // Apply theme on initial mount
  useEffect(() => {
    applyTheme(theme)
  }, [theme])
  
  // Listen for system theme changes when in 'system' mode
  useEffect(() => {
    // Only listen if we're following system preference
    if (theme !== 'system') return
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    
    // Handler to reapply theme when system preference changes
    const handleChange = () => applyTheme('system')
    
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [theme])
  
  // Calculate the effective theme for consumers
  const effectiveTheme = theme === 'system' ? getSystemTheme() : theme
  
  return {
    /** Current theme setting ('light', 'dark', or 'system') */
    theme,
    /** The actually applied theme ('light' or 'dark') */
    effectiveTheme,
    /** Set a specific theme */
    setTheme,
    /** Toggle between light and dark */
    toggleTheme,
    /** Whether currently following system preference */
    isSystem: theme === 'system',
  }
}
