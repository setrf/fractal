/* eslint-disable react-refresh/only-export-components */

/**
 * @fileoverview React Context for global ViewMode access.
 *
 * Provides the view mode state (traditional vs graph) to all components
 * in the tree without prop drilling. Wrap your app with ViewModeProvider
 * to enable view mode switching throughout.
 *
 * @example
 * ```tsx
 * // In App.tsx
 * <ViewModeProvider>
 *   <App />
 * </ViewModeProvider>
 *
 * // In any component
 * const { viewMode, toggleViewMode, isGraphView } = useViewModeContext()
 * ```
 */

import { createContext, useContext, type ReactNode } from 'react'
import { useViewMode, type UseViewModeReturn } from '../hooks/useViewMode'

/**
 * The ViewMode context type.
 * Same as the return type of useViewMode hook.
 */
type ViewModeContextType = UseViewModeReturn

/**
 * React Context for ViewMode.
 * Initially undefined, must be used within ViewModeProvider.
 */
const ViewModeContext = createContext<ViewModeContextType | undefined>(undefined)

/**
 * Props for the ViewModeProvider component.
 */
interface ViewModeProviderProps {
  children: ReactNode
}

/**
 * Provider component for the ViewMode context.
 *
 * Wraps your application to provide view mode functionality to all children.
 * Uses the useViewMode hook internally for state management.
 *
 * @example
 * ```tsx
 * function App() {
 *   return (
 *     <ViewModeProvider>
 *       <MainContent />
 *       <ViewModeToggle />
 *     </ViewModeProvider>
 *   )
 * }
 * ```
 */
export function ViewModeProvider({ children }: ViewModeProviderProps) {
  const viewMode = useViewMode()

  return (
    <ViewModeContext.Provider value={viewMode}>
      {children}
    </ViewModeContext.Provider>
  )
}

/**
 * Hook to access the ViewMode context.
 *
 * Must be used within a ViewModeProvider. Throws an error if used outside.
 *
 * @returns The view mode state and operations
 * @throws Error if used outside of ViewModeProvider
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { viewMode, toggleViewMode, isGraphView } = useViewModeContext()
 *
 *   return (
 *     <button onClick={toggleViewMode}>
 *       {isGraphView ? 'Show Tree' : 'Show Graph'}
 *     </button>
 *   )
 * }
 * ```
 */
export function useViewModeContext(): ViewModeContextType {
  const context = useContext(ViewModeContext)

  if (context === undefined) {
    throw new Error('useViewModeContext must be used within a ViewModeProvider')
  }

  return context
}

/**
 * Export the raw context for advanced use cases.
 * Prefer useViewModeContext hook in most cases.
 */
export { ViewModeContext }
