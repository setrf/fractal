/* eslint-disable react-refresh/only-export-components */

/**
 * @fileoverview React Context for global Stash access.
 *
 * Provides the Stash state and operations to all components in the tree
 * without prop drilling. Wrap your app with StashProvider to enable
 * stash functionality throughout.
 *
 * @example
 * ```tsx
 * // In App.tsx
 * <StashProvider>
 *   <App />
 * </StashProvider>
 *
 * // In any component
 * const { addItem, isOpen, toggleOpen } = useStashContext()
 * ```
 */

import { createContext, useContext, type ReactNode } from 'react'
import { useStash, type UseStashReturn } from '../hooks/useStash'

/**
 * The Stash context type.
 * Same as the return type of useStash hook.
 */
type StashContextType = UseStashReturn

/**
 * React Context for the Stash.
 * Initially undefined, must be used within StashProvider.
 */
const StashContext = createContext<StashContextType | undefined>(undefined)

/**
 * Props for the StashProvider component.
 */
interface StashProviderProps {
  children: ReactNode
}

/**
 * Provider component for the Stash context.
 *
 * Wraps your application to provide stash functionality to all children.
 * Uses the useStash hook internally for state management.
 *
 * @example
 * ```tsx
 * function App() {
 *   return (
 *     <StashProvider>
 *       <MainContent />
 *       <StashSidebar />
 *     </StashProvider>
 *   )
 * }
 * ```
 */
export function StashProvider({ children }: StashProviderProps) {
  const stash = useStash()

  return (
    <StashContext.Provider value={stash}>
      {children}
    </StashContext.Provider>
  )
}

/**
 * Hook to access the Stash context.
 *
 * Must be used within a StashProvider. Throws an error if used outside.
 *
 * @returns The stash state and operations
 * @throws Error if used outside of StashProvider
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { addItem, items, isOpen } = useStashContext()
 *
 *   const handleStash = () => {
 *     addItem({
 *       type: 'highlight',
 *       content: 'some concept',
 *       metadata: {}
 *     })
 *   }
 *
 *   return <button onClick={handleStash}>Stash It</button>
 * }
 * ```
 */
export function useStashContext(): StashContextType {
  const context = useContext(StashContext)

  if (context === undefined) {
    throw new Error('useStashContext must be used within a StashProvider')
  }

  return context
}

/**
 * Export the raw context for advanced use cases.
 * Prefer useStashContext hook in most cases.
 */
export { StashContext }
