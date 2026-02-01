/**
 * @fileoverview React Context for global Probe access.
 *
 * Provides the Probe state and operations to all components in the tree
 * without prop drilling. Wrap your app with ProbeProvider (alongside
 * StashProvider) to enable probe functionality throughout.
 *
 * @example
 * ```tsx
 * // In App.tsx
 * <StashProvider>
 *   <ProbeProvider>
 *     <App />
 *   </ProbeProvider>
 * </StashProvider>
 *
 * // In any component
 * const { createProbe, activeProbe, sendMessage } = useProbeContext()
 * ```
 */

import { createContext, useContext, type ReactNode } from 'react'
import { useProbe, type UseProbeReturn } from '../hooks/useProbe'

/**
 * The Probe context type.
 * Same as the return type of useProbe hook.
 */
type ProbeContextType = UseProbeReturn

/**
 * React Context for Probes.
 * Initially undefined, must be used within ProbeProvider.
 */
const ProbeContext = createContext<ProbeContextType | undefined>(undefined)

/**
 * Props for the ProbeProvider component.
 */
interface ProbeProviderProps {
  children: ReactNode
}

/**
 * Provider component for the Probe context.
 *
 * Wraps your application to provide probe functionality to all children.
 * Uses the useProbe hook internally for state management.
 *
 * @example
 * ```tsx
 * function App() {
 *   return (
 *     <StashProvider>
 *       <ProbeProvider>
 *         <MainContent />
 *         <StashSidebar />
 *         <ProbeSidebar />
 *       </ProbeProvider>
 *     </StashProvider>
 *   )
 * }
 * ```
 */
export function ProbeProvider({ children }: ProbeProviderProps) {
  const probe = useProbe()

  return (
    <ProbeContext.Provider value={probe}>
      {children}
    </ProbeContext.Provider>
  )
}

/**
 * Hook to access the Probe context.
 *
 * Must be used within a ProbeProvider. Throws an error if used outside.
 *
 * @returns The probe state and operations
 * @throws Error if used outside of ProbeProvider
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { createProbe, activeProbe, addMessage } = useProbeContext()
 *
 *   const handleNewProbe = () => {
 *     const probe = createProbe()
 *     if (probe) {
 *       console.log('Created:', probe.name)
 *     }
 *   }
 *
 *   return <button onClick={handleNewProbe}>New Probe</button>
 * }
 * ```
 */
export function useProbeContext(): ProbeContextType {
  const context = useContext(ProbeContext)

  if (context === undefined) {
    throw new Error('useProbeContext must be used within a ProbeProvider')
  }

  return context
}

/**
 * Export the raw context for advanced use cases.
 * Prefer useProbeContext hook in most cases.
 */
export { ProbeContext }
