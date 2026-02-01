/**
 * @fileoverview View mode toggle button component.
 *
 * A fixed-position button that toggles between traditional tree view
 * and 3D knowledge graph view. Uses symbolic icons:
 * - ⌘ for traditional view (structured/tree)
 * - ◈ for graph view (networked/connected)
 *
 * Position: Top-right corner of the viewport, next to ThemeToggle.
 */

import { useViewModeContext } from '../../context/ViewModeContext'
import styles from './ViewModeToggle.module.css'

/**
 * Props for ViewModeToggle component.
 */
export interface ViewModeToggleProps {
  /** Right offset in pixels (to account for probe sidebar) */
  rightOffset?: number
}

/**
 * Fixed toggle button for switching between traditional and graph views.
 *
 * Uses the ViewModeContext for shared state management. The button is positioned
 * fixed in the top-right corner, offset from the ThemeToggle, and is always
 * accessible regardless of scroll position.
 *
 * @param props - Component props
 * @param props.rightOffset - Right offset in pixels (to account for probe sidebar)
 *
 * @example
 * ```tsx
 * function App() {
 *   return (
 *     <ViewModeProvider>
 *       <ThemeToggle rightOffset={probeOpen ? sidebarWidth : 48} />
 *       <ViewModeToggle rightOffset={probeOpen ? sidebarWidth : 48} />
 *       <main>...</main>
 *     </ViewModeProvider>
 *   )
 * }
 * ```
 */
export function ViewModeToggle({ rightOffset = 16 }: ViewModeToggleProps) {
  const { viewMode, toggleViewMode, isGraphView } = useViewModeContext()

  // This button is positioned to the left of ThemeToggle (40px + gap)
  const buttonWidth = 40
  const gap = 8 // var(--space-2)
  const totalRightOffset = rightOffset + buttonWidth + gap

  return (
    <button
      className={styles.toggle}
      onClick={toggleViewMode}
      aria-label={`Switch to ${isGraphView ? 'traditional' : 'graph'} view`}
      title={`Switch to ${isGraphView ? 'traditional tree' : '3D graph'} view`}
      data-view-mode={viewMode}
      data-onboarding="view-toggle"
      style={{
        right: `calc(${totalRightOffset}px + var(--space-4))`,
        transition: 'right var(--transition-normal), border-color var(--transition-fast), background-color var(--transition-fast)',
      }}
    >
      <span className={styles.icon}>
        {/* Tree icon for traditional, network icon for graph */}
        {isGraphView ? '⌘' : '◈'}
      </span>
    </button>
  )
}
