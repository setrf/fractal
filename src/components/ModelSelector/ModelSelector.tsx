/**
 * @fileoverview Model selector for choosing the active LLM.
 */

import { useMemo, type ChangeEvent } from 'react'
import { useModelContext } from '../../context/ModelContext'
import styles from './ModelSelector.module.css'

export interface ModelSelectorProps {
  /** Right offset in pixels (to account for probe sidebar) */
  rightOffset?: number
}

export function ModelSelector({ rightOffset = 16 }: ModelSelectorProps) {
  const { models, selectedModel, setSelectedModel, isLoading, error } = useModelContext()

  const sortedModels = useMemo(() => models.slice().sort((a, b) => a.localeCompare(b)), [models])
  const hasModels = sortedModels.length > 0

  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value
    setSelectedModel(value ? value : null)
  }

  return (
    <div
      className={styles.wrapper}
      style={{
        right: `calc(${rightOffset}px + var(--space-4))`,
        transition: 'right var(--transition-normal)',
      }}
    >
      <label className={styles.label} htmlFor="model-select">
        Model
      </label>
      <select
        id="model-select"
        className={styles.select}
        value={selectedModel ?? ''}
        onChange={handleChange}
        aria-label="Select model"
        disabled={isLoading}
      >
        <option value="">
          {hasModels ? 'Auto (server default)' : isLoading ? 'Loading models…' : 'Auto (server default)'}
        </option>
        {sortedModels.map((model) => (
          <option key={model} value={model}>
            {model}
          </option>
        ))}
      </select>
      {error && (
        <span className={styles.error} title={error}>
          Models unavailable
        </span>
      )}
    </div>
  )
}
