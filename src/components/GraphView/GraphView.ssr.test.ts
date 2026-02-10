import { describe, expect, it, vi } from 'vitest'

describe('GraphView SSR guards', () => {
  it('loads without browser globals and falls back to type color when document is unavailable', async () => {
    const savedWindow = (globalThis as { window?: unknown }).window
    const savedDocument = (globalThis as { document?: unknown }).document

    vi.resetModules()
    vi.doMock('react-force-graph-3d', () => ({ default: () => null }))
    vi.doMock('three-spritetext', () => ({
      default: class SpriteTextMock {
        constructor(public text: string) {}
      },
    }))

    try {
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        writable: true,
        value: undefined,
      })
      Object.defineProperty(globalThis, 'document', {
        configurable: true,
        writable: true,
        value: undefined,
      })

      const mod = await import('./GraphView')
      const fallback = mod.resolveNodeColor({
        id: 'q-ssr',
        type: 'question',
        label: 'SSR question',
        data: {},
        color: 'var(--graph-question)',
        size: 1,
        group: 'g',
      } as any)

      expect(fallback).toBe('#4488dd')
      expect(mod.parseOklchToRgb('oklch(70% 0.14 250)')).toContain('rgb(')
    } finally {
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        writable: true,
        value: savedWindow,
      })
      Object.defineProperty(globalThis, 'document', {
        configurable: true,
        writable: true,
        value: savedDocument,
      })
      vi.doUnmock('react-force-graph-3d')
      vi.doUnmock('three-spritetext')
    }
  })
})
