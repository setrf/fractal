/**
 * @fileoverview Control overlay for the 3D graph visualization.
 *
 * Provides:
 * - Camera reset button
 * - Zoom in/out controls
 * - Node type visibility filters
 * - Legend showing node types and colors
 */

import { useCallback, useState } from 'react'
import { useGraphContext } from '../../context/GraphContext'
import type { GraphNodeType } from '../../types/graph'
import { nodeTypeLabels } from '../../types/graph'
import styles from './GraphControls.module.css'

/**
 * Props for the GraphControls component.
 */
export interface GraphControlsProps {
  /** Callback to reset camera to default position */
  onResetCamera?: () => void
  /** Callback to zoom in */
  onZoomIn?: () => void
  /** Callback to zoom out */
  onZoomOut?: () => void
  /** Right offset in pixels (to account for probe sidebar) */
  rightOffset?: number
}

/**
 * Node type configuration for filters and legend.
 */
const NODE_TYPES: { type: GraphNodeType; color: string; shape: string }[] = [
  { type: 'question', color: 'var(--graph-node-question)', shape: '●' },
  { type: 'concept', color: 'var(--graph-node-concept)', shape: '◆' },
  { type: 'stash', color: 'var(--graph-node-stash)', shape: '■' },
  { type: 'probe', color: 'var(--graph-node-probe)', shape: '○' },
]

/**
 * Control overlay component for the graph view.
 */
export function GraphControls({
  onResetCamera,
  onZoomIn,
  onZoomOut,
  rightOffset = 16,
}: GraphControlsProps) {
  const {
    filters,
    toggleNodeType,
    counts,
    linkDistanceMult,
    setLinkDistanceMult,
    repulsionMult,
    setRepulsionMult,
    centeringMult,
    setCenteringMult,
    frictionMult,
    setFrictionMult,
    visualScale,
    setVisualScale
  } = useGraphContext()

  const [showSettings, setShowSettings] = useState(false)

  // Handle filter toggle
  const handleFilterToggle = useCallback(
    (type: GraphNodeType) => {
      toggleNodeType(type)
    },
    [toggleNodeType]
  )

  // Get filter state key for a type
  const getFilterKey = (type: GraphNodeType): boolean => {
    switch (type) {
      case 'question':
        return filters.showQuestions
      case 'concept':
        return filters.showConcepts
      case 'stash':
        return filters.showStashItems
      case 'probe':
        return filters.showProbes
      default:
        return true
    }
  }

  return (
    <div
      className={styles.container}
      data-onboarding="graph-controls"
      style={{
        right: `calc(${rightOffset}px + var(--space-4))`,
        transition: 'right var(--transition-normal)',
      }}
    >
      {/* Camera controls */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Camera</div>
        <div className={styles.buttonGroup}>
          <button
            className={styles.controlBtn}
            onClick={onResetCamera}
            title="Reset camera (Space)"
            aria-label="Reset camera"
          >
            ⌂
          </button>
          <button
            className={styles.controlBtn}
            onClick={onZoomIn}
            title="Zoom in"
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            className={styles.controlBtn}
            onClick={onZoomOut}
            title="Zoom out"
            aria-label="Zoom out"
          >
            −
          </button>
          <button
            className={`${styles.controlBtn} ${showSettings ? styles.active : ''}`}
            onClick={() => setShowSettings(!showSettings)}
            title="Graph Settings"
            aria-label="Graph settings"
          >
            ⚙
          </button>
        </div>
      </div>

      {/* Settings Panel - Nested here so it inherits rightOffset positioning context or stays relative to button */}
      {showSettings && (
        <div className={styles.settingsPanel}>
          <div className={styles.sectionTitle}>Dynamics</div>
          <div className={styles.settingsGroup}>
            <div className={styles.settingRow}>
              <label>Distance</label>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={linkDistanceMult}
                onChange={(e) => setLinkDistanceMult(parseFloat(e.target.value))}
              />
              <span>{Math.round(linkDistanceMult * 100)}%</span>
            </div>
            <div className={styles.settingRow}>
              <label>Repulsion</label>
              <input
                type="range"
                min="0.5"
                max="3"
                step="0.1"
                value={repulsionMult}
                onChange={(e) => setRepulsionMult(parseFloat(e.target.value))}
              />
              <span>{Math.round(repulsionMult * 100)}%</span>
            </div>
            <div className={styles.settingRow}>
              <label>Gravity</label>
              <input
                type="range"
                min="0.1"
                max="5"
                step="0.1"
                value={centeringMult}
                onChange={(e) => setCenteringMult(parseFloat(e.target.value))}
              />
              <span>{Math.round(centeringMult * 100)}%</span>
            </div>
            <div className={styles.settingRow}>
              <label>Friction</label>
              <input
                type="range"
                min="0.5"
                max="4"
                step="0.1"
                value={frictionMult}
                onChange={(e) => setFrictionMult(parseFloat(e.target.value))}
              />
              <span>{Math.round(frictionMult * 100)}%</span>
            </div>
            <div className={styles.settingRow}>
              <label>Visual Scale</label>
              <input
                type="range"
                min="0.2"
                max="3"
                step="0.1"
                value={visualScale}
                onChange={(e) => setVisualScale(parseFloat(e.target.value))}
              />
              <span>{Math.round(visualScale * 100)}%</span>
            </div>
          </div>
          <button
            className={styles.resetBtn}
            onClick={() => {
              setLinkDistanceMult(1.0)
              setRepulsionMult(1.0)
              setCenteringMult(1.0)
              setFrictionMult(1.0)
              setVisualScale(1.0)
            }}
          >
            Reset All
          </button>
        </div>
      )}

      {/* Filters */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Show</div>
        <div className={styles.filterList}>
          {NODE_TYPES.map(({ type, color, shape }) => {
            const isVisible = getFilterKey(type)
            const count = counts[type]

            return (
              <label
                key={type}
                className={styles.filterItem}
                data-visible={isVisible}
              >
                <input
                  type="checkbox"
                  checked={isVisible}
                  onChange={() => handleFilterToggle(type)}
                  className={styles.checkbox}
                />
                <span
                  className={styles.filterShape}
                  style={{ color: isVisible ? color : 'var(--text-tertiary)' }}
                >
                  {shape}
                </span>
                <span className={styles.filterLabel}>
                  {nodeTypeLabels[type]}
                </span>
                <span className={styles.filterCount}>({count})</span>
              </label>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Legend</div>
        <div className={styles.legendList}>
          {NODE_TYPES.map(({ type, color, shape }) => (
            <div key={type} className={styles.legendItem}>
              <span className={styles.legendShape} style={{ color }}>
                {shape}
              </span>
              <span className={styles.legendLabel}>{nodeTypeLabels[type]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Keyboard shortcuts hint */}
      <div className={styles.shortcuts}>
        <div className={styles.shortcutItem}>
          <kbd>Drag</kbd> Rotate
        </div>
        <div className={styles.shortcutItem}>
          <kbd>Scroll</kbd> Zoom
        </div>
        <div className={styles.shortcutItem}>
          <kbd>Click</kbd> Details
        </div>
      </div>
    </div>
  )
}
