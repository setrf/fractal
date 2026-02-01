/**
 * @fileoverview Theme toggle button component.
 * 
 * A fixed-position button that toggles between light and dark modes.
 * Uses a half-moon symbol that visually indicates the current theme:
 * - ◐ (left half) for light mode
 * - ◑ (right half) for dark mode
 * 
 * Position: Top-right corner of the viewport, offset by probe sidebar width.
 */

import { useTheme } from '../../hooks/useTheme'
import styles from './ThemeToggle.module.css'

/**
 * Props for ThemeToggle component.
 */
export interface ThemeToggleProps {
  /** Right offset in pixels (to account for probe sidebar) */
  rightOffset?: number
}

/**
 * Fixed toggle button for switching between light and dark themes.
 * 
 * Uses the useTheme hook for state management. The button is positioned
 * fixed in the top-right corner and is always accessible regardless of
 * scroll position.
 * 
 * @param props - Component props
 * @param props.rightOffset - Right offset in pixels (to account for probe sidebar)
 * 
 * @example
 * ```tsx
 * function App() {
 *   return (
 *     <>
 *       <ThemeToggle rightOffset={probeOpen ? probeSidebarWidth : 48} />
 *       <main>...</main>
 *     </>
 *   )
 * }
 * ```
 */
export function ThemeToggle({ rightOffset = 16 }: ThemeToggleProps) {
  const { effectiveTheme, toggleTheme } = useTheme()
  
  return (
    <button
      className={styles.toggle}
      onClick={toggleTheme}
      aria-label={`Switch to ${effectiveTheme === 'light' ? 'dark' : 'light'} mode`}
      title={`Switch to ${effectiveTheme === 'light' ? 'dark' : 'light'} mode`}
      style={{
        right: `calc(${rightOffset}px + var(--space-4))`,
        transition: 'right var(--transition-normal), border-color var(--transition-fast), background-color var(--transition-fast)',
      }}
    >
      <span className={styles.icon}>
        {/* Half-moon symbols indicate current theme */}
        {effectiveTheme === 'light' ? '◐' : '◑'}
      </span>
    </button>
  )
}
