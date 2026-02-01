/**
 * @fileoverview React Context for global model selection.
 */

import { createContext, useContext, type ReactNode } from 'react'
import { useModelSelection, type UseModelSelectionReturn } from '../hooks/useModelSelection'

type ModelContextType = UseModelSelectionReturn

const ModelContext = createContext<ModelContextType | undefined>(undefined)

interface ModelProviderProps {
  children: ReactNode
}

export function ModelProvider({ children }: ModelProviderProps) {
  const modelSelection = useModelSelection()
  return (
    <ModelContext.Provider value={modelSelection}>
      {children}
    </ModelContext.Provider>
  )
}

export function useModelContext(): ModelContextType {
  const context = useContext(ModelContext)
  if (!context) {
    throw new Error('useModelContext must be used within a ModelProvider')
  }
  return context
}

export { ModelContext }
