/**
 * Test Setup
 * ==========
 * 
 * Global test configuration and utilities.
 * This file runs before each test file.
 * 
 * Provides:
 * - jest-dom matchers for DOM assertions
 * - Custom matchers for detailed output
 * - Mock implementations for browser APIs
 */

import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeAll, vi } from 'vitest'

vi.mock('react-force-graph-3d', () => ({
  default: () => null,
}))

vi.mock('three', () => {
  class Object3D {}
  class BufferGeometry {}
  class Material {}
  class SphereGeometry extends BufferGeometry {}
  class IcosahedronGeometry extends BufferGeometry {}
  class BoxGeometry extends BufferGeometry {}
  class TorusGeometry extends BufferGeometry {}
  class MeshPhongMaterial extends Material {}
  class MeshBasicMaterial extends Material {}
  class Mesh {
    geometry: BufferGeometry
    material: Material
    constructor(geometry: BufferGeometry, material: Material) {
      this.geometry = geometry
      this.material = material
    }
  }
  class Vector3 {
    x: number
    y: number
    z: number
    constructor(x = 0, y = 0, z = 0) {
      this.x = x
      this.y = y
      this.z = z
    }
    normalize() {
      return this
    }
    multiplyScalar() {
      return this
    }
  }
  return {
    Object3D,
    BufferGeometry,
    Material,
    SphereGeometry,
    IcosahedronGeometry,
    BoxGeometry,
    TorusGeometry,
    MeshPhongMaterial,
    MeshBasicMaterial,
    Mesh,
    Vector3,
  }
})

// Cleanup after each test to prevent state leakage
afterEach(() => {
  cleanup()
})

// Mock localStorage
const localStorageMock = {
  store: {} as Record<string, string>,
  getItem: vi.fn((key: string) => localStorageMock.store[key] || null),
  setItem: vi.fn((key: string, value: string) => {
    localStorageMock.store[key] = value
  }),
  removeItem: vi.fn((key: string) => {
    delete localStorageMock.store[key]
  }),
  clear: vi.fn(() => {
    localStorageMock.store = {}
  }),
}

// Mock matchMedia for theme detection
const matchMediaMock = vi.fn((query: string) => ({
  matches: query.includes('dark') ? false : true,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}))

beforeAll(() => {
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
  })
  Object.defineProperty(window, 'matchMedia', {
    value: matchMediaMock,
  })
})

// Reset mocks between tests
afterEach(() => {
  localStorageMock.store = {}
  vi.clearAllMocks()
})

// Export mocks for direct access in tests
export { localStorageMock, matchMediaMock }
