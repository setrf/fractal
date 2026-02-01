/**
 * @fileoverview 3D Knowledge Graph visualization component.
 *
 * Uses react-force-graph-3d to render an interactive 3D graph of all
 * entities (Questions, Concepts, Stash Items, Probes) with force-directed
 * layout and relationship-based clustering.
 *
 * Features:
 * - Custom 3D shapes per node type (spheres, icosahedrons, cubes, tori)
 * - Color-coded nodes based on entity type and category
 * - Interactive node clicking for popups
 * - Zoom/pan/rotate navigation
 * - Clustering based on relationships
 */

import { useRef, useCallback, useEffect, useState, useImperativeHandle, forwardRef, useMemo } from 'react'
import ForceGraph3D, { type ForceGraph3DInstance } from 'react-force-graph-3d'
import * as THREE from 'three'
import { useGraphContext } from '../../context/GraphContext'
import type { GraphNode, GraphEdge, GraphNodeType } from '../../types/graph'
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

function createNodeObject(node: GraphNode): THREE.Object3D {
  const baseSize = 5 * node.size
  let geometry: THREE.BufferGeometry
  let material: THREE.Material

  const resolvedColor = resolveNodeColor(node)

  switch (node.type) {
    case 'question':
      // Sphere with slight glow
      geometry = new THREE.SphereGeometry(baseSize, 16, 16)
      material = new THREE.MeshPhongMaterial({
        color: resolvedColor,
        emissive: resolvedColor,
        emissiveIntensity: 0.2,
        shininess: 30,
      })
      break

    case 'concept':
      // Icosahedron for concepts
      geometry = new THREE.IcosahedronGeometry(baseSize * 0.8, 0)
      material = new THREE.MeshPhongMaterial({
        color: resolvedColor,
        emissive: resolvedColor,
        emissiveIntensity: 0.15,
        shininess: 50,
        flatShading: true,
      })
      break

    case 'stash':
      // Cube for stash items
      geometry = new THREE.BoxGeometry(baseSize * 1.2, baseSize * 1.2, baseSize * 1.2)
      material = new THREE.MeshPhongMaterial({
        color: resolvedColor,
        emissive: resolvedColor,
        emissiveIntensity: 0.1,
        shininess: 20,
      })
      break

    case 'probe':
      // Torus for probes
      geometry = new THREE.TorusGeometry(baseSize, baseSize * 0.4, 8, 16)
      material = new THREE.MeshPhongMaterial({
        color: resolvedColor,
        emissive: resolvedColor,
        emissiveIntensity: 0.25,
        shininess: 60,
      })
      break

    default:
      geometry = new THREE.SphereGeometry(baseSize, 12, 12)
      material = new THREE.MeshBasicMaterial({ color: '#888888' })
  }

  const mesh = new THREE.Mesh(geometry, material)

  // Add slight rotation animation for probes
  if (node.type === 'probe') {
    mesh.rotation.x = Math.PI / 2
  }

  return mesh
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
  const graphRef = useRef<ForceGraph3DInstance>()
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })
  const { graphData, counts } = useGraphContext()

  useImperativeHandle(ref, () => {
    const resetCamera = () => {
      graphRef.current?.zoomToFit?.(600, 80)
    }

    const adjustZoom = (factor: number) => {
      const camera = graphRef.current?.camera()
      if (!camera) return
      const current = new THREE.Vector3(camera.position.x, camera.position.y, camera.position.z)
      const distance = current.length()
      if (distance === 0) return
      const direction = current.normalize()
      const targetDistance = distance * factor
      const newPosition = direction.multiplyScalar(targetDistance)
      graphRef.current?.cameraPosition(
        { x: newPosition.x, y: newPosition.y, z: newPosition.z },
        { x: 0, y: 0, z: 0 },
        300
      )
    }

    return {
      resetCamera,
      zoomIn: () => adjustZoom(0.8),
      zoomOut: () => adjustZoom(1.25),
    }
  }, [])

  // Update dimensions on resize
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

  // Configure forces for clustering
  useEffect(() => {
    if (!graphRef.current) return

    const fg = graphRef.current

    // Configure link force for distance based on edge type
    fg.d3Force('link')
      ?.distance((link: GraphEdge) => {
        switch (link.type) {
          case 'question-child':
            return 50
          case 'question-concept':
            return 80
          case 'concept-related':
            return 120
          case 'stash-source':
            return 100
          case 'probe-stash':
            return 90
          default:
            return 100
        }
      })
      .strength((link: GraphEdge) => link.strength * 0.5)

    // Increase charge for better spacing
    fg.d3Force('charge')?.strength(-150)

    // Add some centering force
    fg.d3Force('center')?.strength(0.05)
  }, [graphData])

  // Handle node click
  const handleNodeClick = useCallback(
    (node: GraphNode, event: MouseEvent) => {
      if (onNodeClick) {
        onNodeClick(node, event)
      }

      // Focus camera on clicked node
      if (graphRef.current && node.x !== undefined && node.y !== undefined && node.z !== undefined) {
        const distance = 150
        const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z)

        graphRef.current.cameraPosition(
          {
            x: node.x * distRatio,
            y: node.y * distRatio,
            z: node.z * distRatio,
          },
          { x: node.x, y: node.y, z: node.z },
          1000 // Animation duration
        )
      }
    },
    [onNodeClick]
  )

  // Get link color based on type
  const getLinkColor = useCallback((link: GraphEdge) => {
    return EDGE_COLORS[link.type] || '#666666'
  }, [])

  // Get link width based on type
  const getLinkWidth = useCallback((link: GraphEdge) => {
    return EDGE_WIDTHS[link.type] || 1
  }, [])

  // Resolve CSS variables/OKLCH to RGB for library compatibility
  const resolvedNodes = useMemo(
    () => graphData.nodes.map(node => ({ ...node, color: resolveNodeColor(node) })),
    [graphData.nodes]
  )

  // Transform graph data for react-force-graph (needs source/target as objects or ids)
  const transformedData = {
    nodes: resolvedNodes,
    links: graphData.edges.map((edge) => ({
      ...edge,
      source: edge.source,
      target: edge.target,
    })),
  }

  return (
    <div ref={containerRef} className={styles.container} data-onboarding="graph-view">
      {/* Empty state */}
      {graphData.nodes.length === 0 && (
        <div className={styles.emptyState}>
          <p>No entities to visualize yet.</p>
          <p className={styles.emptyHint}>
            Switch to traditional view (click ◈), enter a question, then switch back to see the graph.
          </p>
        </div>
      )}

      {/* 3D Graph */}
      {graphData.nodes.length > 0 && (
        <ForceGraph3D
          ref={graphRef}
          graphData={transformedData}
          width={dimensions.width}
          height={dimensions.height}
          backgroundColor="rgba(0, 0, 0, 0)"
          // Node configuration
          nodeLabel={(node: GraphNode) => node.label}
          nodeColor={(node: GraphNode) => resolveNodeColor(node)}
          nodeThreeObject={createNodeObject}
          nodeThreeObjectExtend={false}
          onNodeClick={handleNodeClick}
          // Link configuration
          linkColor={getLinkColor}
          linkWidth={getLinkWidth}
          linkOpacity={0.6}
          linkDirectionalParticles={0}
          // Physics configuration
          d3AlphaDecay={0.02}
          d3VelocityDecay={0.3}
          cooldownTime={3000}
          warmupTicks={50}
          // Camera configuration
          enableNavigationControls={true}
          showNavInfo={false}
        />
      )}

      {/* Stats overlay */}
      <div
        className={styles.stats}
        style={{
          left: `calc(${leftOffset}px + var(--space-4))`,
          transition: 'left var(--transition-normal)',
        }}
      >
        <span className={styles.statItem} data-type="question">
          {counts.question} Questions
        </span>
        <span className={styles.statItem} data-type="concept">
          {counts.concept} Concepts
        </span>
        <span className={styles.statItem} data-type="stash">
          {counts.stash} Stash
        </span>
        <span className={styles.statItem} data-type="probe">
          {counts.probe} Probes
        </span>
      </div>
    </div>
  )
})
