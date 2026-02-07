/**
 * @fileoverview Tests for the API client.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  generateQuestions,
  checkHealth,
  isApiAvailable,
  listModels,
} from './client'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('API Client', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('generateQuestions()', () => {
    it('should call the generate endpoint with correct payload', async () => {
      console.log('[TEST] Testing generateQuestions API call')
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            questions: ['Question 1?', 'Question 2?'],
            model: 'test-model',
            usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
          },
        }),
      })

      const result = await generateQuestions('What is life?')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/generate'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: 'What is life?' }),
        })
      )
      
      console.log('[TEST] Generated questions:', result)
      expect(result.questions).toEqual(['Question 1?', 'Question 2?'])
    })

    it('should pass optional model parameter', async () => {
      console.log('[TEST] Testing generateQuestions with model parameter')
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            questions: ['Q1?'],
            model: 'custom-model',
            usage: { promptTokens: 5, completionTokens: 10, totalTokens: 15 },
          },
        }),
      })

      await generateQuestions('Test?', 'custom-model')

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body)
      console.log('[TEST] Request body:', callBody)
      
      expect(callBody.model).toBe('custom-model')
    })

    it('should throw error on API failure', async () => {
      console.log('[TEST] Testing generateQuestions error handling')
      
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: 'Bad Request',
          message: 'Question is required',
        }),
      })

      await expect(generateQuestions('')).rejects.toThrow('Question is required')
      console.log('[TEST] Error thrown as expected')
    })

    it('should timeout slow requests when timeoutMs is exceeded', async () => {
      vi.useFakeTimers()
      try {
        mockFetch.mockImplementationOnce((_, init?: RequestInit) => (
          new Promise((_resolve, reject) => {
            const signal = init?.signal as AbortSignal | undefined
            signal?.addEventListener('abort', () => {
              reject(new DOMException('Aborted', 'AbortError'))
            })
          })
        ))

        // Attach rejection handling immediately to avoid unhandled rejection warnings.
        const requestResult = generateQuestions('Slow request?', undefined, { timeoutMs: 25 })
          .then(() => null)
          .catch((err) => err as Error)

        await vi.advanceTimersByTimeAsync(30)
        const error = await requestResult

        expect(error).toBeInstanceOf(Error)
        expect(error?.message).toContain('Request timed out after 25ms')
      } finally {
        vi.useRealTimers()
      }
    })

    it('should support caller-driven abort signals', async () => {
      const controller = new AbortController()
      controller.abort()

      mockFetch.mockImplementationOnce((_, init?: RequestInit) => {
        const signal = init?.signal as AbortSignal | undefined
        if (signal?.aborted) {
          return Promise.reject(new DOMException('Aborted', 'AbortError'))
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: {
              questions: [],
              model: 'test-model',
              usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
            },
          }),
        })
      })

      await expect(
        generateQuestions('Cancelled?', undefined, { signal: controller.signal })
      ).rejects.toThrow('Request cancelled')
    })
  })

  describe('checkHealth()', () => {
    it('should return health status', async () => {
      console.log('[TEST] Testing checkHealth')
      
      const mockHealth = {
        status: 'healthy',
        timestamp: '2026-01-31T12:00:00.000Z',
        services: { inference: 'up' },
      }
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockHealth,
      })

      const result = await checkHealth()
      
      console.log('[TEST] Health status:', result)
      expect(result.status).toBe('healthy')
      expect(result.services.inference).toBe('up')
    })

    it('should throw on health check failure', async () => {
      console.log('[TEST] Testing checkHealth failure')
      
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
      })

      await expect(checkHealth()).rejects.toThrow('Health check failed')
      console.log('[TEST] Error thrown as expected')
    })
  })

  describe('listModels()', () => {
    it('should fetch available models', async () => {
      console.log('[TEST] Testing listModels')

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { models: ['model-a', 'model-b'] },
        }),
      })

      const models = await listModels()

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/models'),
        expect.objectContaining({
          method: 'GET',
        })
      )
      expect(models).toEqual(['model-a', 'model-b'])
    })
  })

  describe('isApiAvailable()', () => {
    it('should return true when API is healthy', async () => {
      console.log('[TEST] Testing isApiAvailable - healthy')
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          services: { inference: 'up' },
        }),
      })

      const result = await isApiAvailable()
      
      console.log('[TEST] API available:', result)
      expect(result).toBe(true)
    })

    it('should return false when API is degraded', async () => {
      console.log('[TEST] Testing isApiAvailable - degraded')
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'degraded',
          timestamp: new Date().toISOString(),
          services: { inference: 'down' },
        }),
      })

      const result = await isApiAvailable()
      
      console.log('[TEST] API available:', result)
      expect(result).toBe(false)
    })

    it('should return false when fetch fails', async () => {
      console.log('[TEST] Testing isApiAvailable - network error')
      
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const result = await isApiAvailable()
      
      console.log('[TEST] API available:', result)
      expect(result).toBe(false)
    })
  })
})
