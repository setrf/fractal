/**
 * @fileoverview 3D Knowledge Graph visualization component.
 *
 * Uses react-force-graph-3d to render an interactive 3D graph of all
 * entities (Questions, Concepts, Stash Items, Probes).
 *
 * Design: "Information Dense Beauty"
 * - Swiss/Neobrutalist influence: sharp edges, monospace fonts
 * - Legible information tags instead of flashy 3D primitives
 * - Clean, structured layout with relationship clustering
 */

import { useRef, useCallback, useEffect, useState, useImperativeHandle, forwardRef, useMemo } from 'react'
import ForceGraph3D from 'react-force-graph-3d'
import * as THREE from 'three'
import SpriteText from 'three-spritetext'
import { useGraphContext } from '../../context/GraphContext'
import { useIsMobile } from '../../hooks/useIsMobile'
import type { GraphNode, GraphEdge, GraphNodeType } from '../../types/graph'
import type { ForceGraphMethods } from 'react-force-graph-3d'
import { EDGE_WIDTHS } from '../../types/graph'
import styles from './GraphView.module.css'

/**
 * Props for the GraphView component.
 */
export interface GraphViewProps {
  /** Callback when a node is clicked */
  onNodeClick?: (node: GraphNode, event: MouseEvent) => void
  /** Width of the graph container (defaults to 100%) */
  width?: number
  /** Height of the graph container (defaults to 100vh minus header) */
  height?: number
  /** Left offset in pixels (to account for stash sidebar) */
  leftOffset?: number
}

export interface GraphViewHandle {
  /** Reset camera to fit all nodes */
  resetCamera: () => void
  /** Zoom in */
  zoomIn: () => void
  /** Zoom out */
  zoomOut: () => void
}

/**
 * Edge color mappings based on edge type.
 */
const EDGE_COLORS: Record<string, string> = {
  'question-child': '#666666',
  'question-concept': '#888888',
  'concept-related': '#aaaaaa',
  'stash-source': '#44aa88',
  'probe-stash': '#dd8844',
}

/**
 * Creates a custom 3D object for a node based on its type.
 */
const colorCache = new Map<string, string>()

function parseOklchToRgb(color: string): string | null {
  const match = color.trim().match(/^oklch\((.+)\)$/i)
  if (!match) return null

  const body = match[1].split('/')[0].trim()
  const parts = body.split(/\s+/)
  if (parts.length < 3) return null

  const parseChannel = (value: string, isPercent = false) => {
    if (value.endsWith('%')) {
      return parseFloat(value) / 100
    }
    const numeric = parseFloat(value)
    return isPercent ? numeric / 100 : numeric
  }

  const L = parseChannel(parts[0], true)
  const C = parseFloat(parts[1])
  const H = parseFloat(parts[2])
  if (Number.isNaN(L) || Number.isNaN(C) || Number.isNaN(H)) return null

  const hr = (H / 180) * Math.PI
  const a = C * Math.cos(hr)
  const b = C * Math.sin(hr)

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b

  const l = l_ ** 3
  const m = m_ ** 3
  const s = s_ ** 3

  let r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
  let g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
  let bOut = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s

  const toSrgb = (value: number) => {
    const clamped = Math.min(1, Math.max(0, value))
    return clamped <= 0.0031308
      ? 12.92 * clamped
      : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055
  }

  r = toSrgb(r)
  g = toSrgb(g)
  bOut = toSrgb(bOut)

  const r255 = Math.round(r * 255)
  const g255 = Math.round(g * 255)
  const b255 = Math.round(bOut * 255)
  return `rgb(${r255}, ${g255}, ${b255})`
}

function resolveNodeColor(node: GraphNode): string {
  const fallback = getHexFromNodeType(node.type)
  const color = (node.color || fallback).trim()
  const needsResolve = color.includes('oklch') || color.startsWith('var(')
  if (!needsResolve) return color
  if (typeof document === 'undefined') return fallback

  const cached = colorCache.get(color)
  if (cached) return cached

  let resolved = color
  if (resolved.startsWith('var(')) {
    const varName = resolved.slice(4, -1).trim()
    const cssValue = getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
    resolved = cssValue || resolved
  }

  const rgb = parseOklchToRgb(resolved)
  if (rgb) {
    colorCache.set(color, rgb)
    return rgb
  }

  if (resolved.includes('oklch') || resolved.startsWith('var(')) {
    colorCache.set(color, fallback)
    return fallback
  }

  colorCache.set(color, resolved)
  return resolved
}

/**
 * Creates a "Swiss Design" tag node object.
 */
function createNodeObject(node: GraphNode): THREE.Object3D {
  const color = resolveNodeColor(node)

  // Wrap and truncate long labels for the 3D tag
  const MAX_TAG_LENGTH = 60
  const displayLabel = node.label.length > MAX_TAG_LENGTH 
    ? node.label.slice(0, MAX_TAG_LENGTH) + '...'
    : node.label
  const wrappedLabel = wrapLabel(displayLabel, 25)
  const typeLabel = node.type.charAt(0).toUpperCase() + node.type.slice(1)
  const fullText = `${wrappedLabel}\n[${typeLabel}]`

  const group = new THREE.Group()

  // 1. Icon/Marker Geometry
  const baseSize = node.type === 'question' ? 4 : 2
  const markerSize = baseSize * (node.visualScale || 1)
  
  let geometry: THREE.BufferGeometry
  switch (node.type) {
    case 'concept':
      geometry = new THREE.IcosahedronGeometry(markerSize)
      break
    case 'stash':
      geometry = new THREE.BoxGeometry(markerSize * 1.5, markerSize * 1.5, markerSize * 1.5)
      break
    case 'probe':
      geometry = new THREE.TorusGeometry(markerSize, markerSize * 0.4, 8, 16)
      break
    case 'question':
    default:
      geometry = new THREE.SphereGeometry(markerSize, 16, 16)
      break
  }
  
  const markerMaterial = new THREE.MeshBasicMaterial({ color })
  const mesh = new THREE.Mesh(geometry, markerMaterial)
  group.add(mesh)

  // 2. Label Sprite
  const sprite = new SpriteText(fullText)
  sprite.color = 'rgba(255, 255, 255, 0.95)'
  sprite.fontFace = "'JetBrains Mono', 'IBM Plex Mono', monospace"
  sprite.textHeight = 2.5 * (node.visualScale || 1)
  sprite.fontWeight = '600'
  sprite.center = new THREE.Vector2(0.5, 1)

  sprite.backgroundColor = 'rgba(0, 0, 0, 0.7)'
  sprite.padding = [4, 6]
  sprite.borderRadius = 2
  sprite.borderWidth = 0

  sprite.position.set(0, - (markerSize + 5), 0)
  group.add(sprite)

  return group
}

/**
 * Helper to wrap text into multiple lines.
 */
function wrapLabel(text: string, maxLineLength: number): string {
  if (!text) return ''
  const words = text.split(' ')
  const lines: string[] = []
  let currentLine = words[0]

  for (let i = 1; i < words.length; i++) {
    if (currentLine.length + 1 + words[i].length <= maxLineLength) {
      currentLine += ' ' + words[i]
    } else {
      lines.push(currentLine)
      currentLine = words[i]
    }
  }
  lines.push(currentLine)
  return lines.join('\n')
}

/**
 * Gets a hex color from node type for Three.js compatibility.
 */
function getHexFromNodeType(type: GraphNodeType): string {
  const colors: Record<GraphNodeType, string> = {
    question: '#4488dd',
    concept: '#aa66cc',
    stash: '#44aa88',
    probe: '#dd8844',
  }
  return colors[type]
}

/**
 * Main 3D Graph visualization component.
 */
export const GraphView = forwardRef<GraphViewHandle, GraphViewProps>(function GraphView(
  { onNodeClick, width, height, leftOffset = 16 }: GraphViewProps,
  ref
) {
  const graphRef = useRef<ForceGraphMethods<GraphNode, GraphEdge> | undefined>(undefined)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })
  const isMobile = useIsMobile()
  const [showMobileWarning, setShowMobileWarning] = useState(true)
  const {
    graphData,
    counts,
    linkDistanceMult,
    repulsionMult,
    centeringMult,
    frictionMult,
    visualScale
  } = useGraphContext()

  useImperativeHandle(ref, () => ({
    resetCamera: () => {
      graphRef.current?.zoomToFit?.(600, 80)
    },
    zoomIn: () => {
      const camera = graphRef.current?.camera()
      if (!camera) return
      const current = new THREE.Vector3(camera.position.x, camera.position.y, camera.position.z)
      const distance = current.length()
      if (distance === 0) return
      const direction = current.normalize()
      graphRef.current?.cameraPosition(
        { x: direction.x * distance * 0.8, y: direction.y * distance * 0.8, z: direction.z * distance * 0.8 },
        { x: 0, y: 0, z: 0 },
        300
      )
    },
    zoomOut: () => {
      const camera = graphRef.current?.camera()
      if (!camera) return
      const current = new THREE.Vector3(camera.position.x, camera.position.y, camera.position.z)
      const distance = current.length()
      if (distance === 0) return
      const direction = current.normalize()
      graphRef.current?.cameraPosition(
        { x: direction.x * distance * 1.25, y: direction.y * distance * 1.25, z: direction.z * distance * 1.25 },
        { x: 0, y: 0, z: 0 },
        300
      )
    }
  }), [])

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: width || containerRef.current.clientWidth,
          height: height || containerRef.current.clientHeight,
        })
      }
    }
    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    return () => window.removeEventListener('resize', updateDimensions)
  }, [width, height])

  // Configure forces
  useEffect(() => {
    if (!graphRef.current) return
    const fg = graphRef.current

    // Configure link force for distance based on edge type
    const linkForce = fg.d3Force('link')
    if (typeof linkForce?.distance === 'function') {
      linkForce
        .distance((link: GraphEdge) => {
          let baseDist = 100
          switch (link.type) {
            case 'question-child': baseDist = 80; break
            case 'question-concept': baseDist = 100; break
            case 'concept-related': baseDist = 120; break
            case 'stash-source': baseDist = 90; break
            case 'probe-stash': baseDist = 80; break
            default: baseDist = 100; break
          }
          return baseDist * linkDistanceMult
        })
        ?.strength?.((link: GraphEdge) => link.strength * 0.7)
    }

    // Scale repulsion relative to distance to maintain consistent "pressure"
    fg.d3Force('charge')?.strength?.(-100 * repulsionMult * Math.pow(linkDistanceMult, 1.5))

    // Centering force
    fg.d3Force('center')?.strength?.(0.5 * centeringMult)
  }, [graphData, linkDistanceMult, repulsionMult, centeringMult])

  const handleNodeClick = useCallback(
    (node: GraphNode, event: MouseEvent) => {
      if (onNodeClick) onNodeClick(node, event)
      if (graphRef.current && node.x !== undefined && node.y !== undefined && node.z !== undefined) {
        const distance = 250
        const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z)
        graphRef.current.cameraPosition(
          { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio },
          { x: node.x, y: node.y, z: node.z },
          1000
        )
      }
    },
    [onNodeClick]
  )

  const handleBackgroundClick = useCallback(() => {
    // Intentionally no-op: background clicks should not trigger node interactions.
  }, [])

  const getLinkColor = useCallback((link: GraphEdge) => EDGE_COLORS[link.type] || '#666666', [])
  const getLinkWidth = useCallback((link: GraphEdge) => EDGE_WIDTHS[link.type] || 1, [])

  const resolvedNodes = useMemo(
    () => graphData.nodes.map(node => ({ ...node, color: resolveNodeColor(node) })),
    [graphData.nodes]
  )

  const transformedData = useMemo(() => ({
    nodes: resolvedNodes.map(node => ({ ...node, visualScale })),
    links: graphData.edges.map((edge) => ({
      ...edge,
      source: edge.source,
      target: edge.target,
    })),
  }), [resolvedNodes, graphData.edges, visualScale])

  return (
    <div ref={containerRef} className={styles.container} data-onboarding="graph-view">
      {graphData.nodes.length === 0 && (
        <div className={styles.emptyState}>
          <p>No entities to visualize yet.</p>
          <p className={styles.emptyHint}>
            Switch to traditional view (click ◈), enter a question, then switch back to see the graph.
          </p>
        </div>
      )}

      {graphData.nodes.length > 0 && (
        <>
          <ForceGraph3D
            ref={graphRef}
            graphData={transformedData}
            width={dimensions.width}
            height={dimensions.height}
            backgroundColor="rgba(0, 0, 0, 0)"
            nodeLabel={(node: GraphNode) => `
              <div style="
                background: oklch(from var(--bg-primary) l c h / 0.95);
                color: var(--text-primary);
                padding: 8px 12px;
                border: 2px solid var(--border-primary);
                font-family: var(--font-mono);
                font-size: 12px;
                max-width: 300px;
                line-height: 1.4;
                box-shadow: 4px 4px 0 var(--border-primary);
              ">
                <div style="font-weight: 700; text-transform: uppercase; color: var(--text-tertiary); margin-bottom: 4px; font-size: 10px;">${node.type}</div>
                <div>${node.label}</div>
              </div>
            `}
            nodeColor={(node: GraphNode) => resolveNodeColor(node)}
            nodeThreeObject={createNodeObject}
            nodeThreeObjectExtend={false}
            onNodeClick={handleNodeClick}
            onBackgroundClick={handleBackgroundClick}
            linkColor={getLinkColor}
            linkWidth={getLinkWidth}
            linkHoverPrecision={10}
            linkDirectionalArrowLength={3.5}
            linkDirectionalArrowRelPos={1}
            linkOpacity={0.4}
            linkDirectionalParticles={0}
            d3AlphaDecay={0.01}
            d3VelocityDecay={0.5 * frictionMult}
            cooldownTime={5000}
            warmupTicks={100}
            enableNavigationControls={true}
            showNavInfo={false}
          />
          {isMobile && showMobileWarning && (
            <div className={styles.mobileOverlay}>
              <div className={styles.mobileWarning}>
                <button 
                  className={styles.dismissWarning} 
                  onClick={() => setShowMobileWarning(false)}
                  aria-label="Dismiss warning"
                >
                  ×
                </button>
                <span className={styles.warningIcon}>⚠️</span>
                <p>3D interaction is limited on mobile.</p>
                <p className={styles.warningHint}>Switch to Traditional view (⌘) for the best experience.</p>
              </div>
            </div>
          )}
        </>
      )}

      <div
        className={styles.stats}
        style={{
          left: `calc(${leftOffset}px + var(--space-4))`,
          transition: 'left var(--transition-normal)',
        }}
      >
        <span className={styles.statItem} data-type="question">{counts.question} Questions</span>
        <span className={styles.statItem} data-type="concept">{counts.concept} Concepts</span>
        <span className={styles.statItem} data-type="stash">{counts.stash} Stash</span>
        <span className={styles.statItem} data-type="probe">{counts.probe} Probes</span>
      </div>
    </div>
  )
})
