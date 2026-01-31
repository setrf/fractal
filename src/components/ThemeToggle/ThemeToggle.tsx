/**
 * @fileoverview Theme toggle button component.
 * 
 * A fixed-position button that toggles between light and dark modes.
 * Uses a half-moon symbol that visually indicates the current theme:
 * - ◐ (left half) for light mode
 * - ◑ (right half) for dark mode
 * 
 * Position: Top-right corner of the viewport.
 */

import { useTheme } from '../../hooks/useTheme'
import styles from './ThemeToggle.module.css'

/**
 * Fixed toggle button for switching between light and dark themes.
 * 
 * Uses the useTheme hook for state management. The button is positioned
 * fixed in the top-right corner and is always accessible regardless of
 * scroll position.
 * 
 * @example
 * ```tsx
 * function App() {
 *   return (
 *     <>
 *       <ThemeToggle />
 *       <main>...</main>
 *     </>
 *   )
 * }
 * ```
 */
export function ThemeToggle() {
  const { effectiveTheme, toggleTheme } = useTheme()
  
  return (
    <button
      className={styles.toggle}
      onClick={toggleTheme}
      aria-label={`Switch to ${effectiveTheme === 'light' ? 'dark' : 'light'} mode`}
      title={`Switch to ${effectiveTheme === 'light' ? 'dark' : 'light'} mode`}
    >
      <span className={styles.icon}>
        {/* Half-moon symbols indicate current theme */}
        {effectiveTheme === 'light' ? '◐' : '◑'}
      </span>
    </button>
  )
}
