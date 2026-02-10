/**
 * @fileoverview Tests for the API client.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  generateQuestions,
  compareQuestionGenerations,
  getEvalStats,
  checkHealth,
  isApiAvailable,
  listModels,
  getModelPerformance,
  sendChatMessage,
  extractConcepts,
  sendProbeChatMessage,
  exportProbeBrief,
  suggestProbeExperiments,
  explainConcept,
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

    it('should allow requests when timeout is explicitly disabled', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            questions: ['No timeout'],
            model: 'test-model',
            usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
          },
        }),
      })

      const result = await generateQuestions('No timeout?', undefined, { timeoutMs: 0 })
      expect(result.questions).toEqual(['No timeout'])
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

    it('should forward abort events from external signal after request starts', async () => {
      const controller = new AbortController()
      const addListenerSpy = vi.spyOn(controller.signal, 'addEventListener')
      const removeListenerSpy = vi.spyOn(controller.signal, 'removeEventListener')

      mockFetch.mockImplementationOnce((_, init?: RequestInit) => (
        new Promise((_resolve, reject) => {
          const signal = init?.signal as AbortSignal | undefined
          signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'))
          })
        })
      ))

      const pending = generateQuestions('Will abort', undefined, { signal: controller.signal })
      controller.abort()

      await expect(pending).rejects.toThrow('Request cancelled')
      expect(addListenerSpy).toHaveBeenCalledWith('abort', expect.any(Function), { once: true })
      expect(removeListenerSpy).toHaveBeenCalledWith('abort', expect.any(Function))
    })

    it('treats DOM TimeoutError rejections as cancelled requests', async () => {
      mockFetch.mockRejectedValueOnce(new DOMException('Timed out', 'TimeoutError'))

      await expect(
        generateQuestions('timeout-error path', undefined, { timeoutMs: 0 })
      ).rejects.toThrow('Request cancelled')
    })

    it('uses error field from API error payloads when message is absent', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: 'Generated from error field',
        }),
      })

      await expect(generateQuestions('error field')).rejects.toThrow('Generated from error field')
    })

    it('falls back to default error text when API error payload has no message fields', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
      })

      await expect(generateQuestions('missing message fields')).rejects.toThrow('Failed to generate questions')
    })

    it('wraps non-Error fetch failures with fallback messages', async () => {
      mockFetch.mockRejectedValueOnce('raw failure')

      await expect(generateQuestions('non-error fetch failure')).rejects.toThrow('Failed to generate questions')
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

  describe('additional API wrappers', () => {
    it('compareQuestionGenerations returns comparison payload', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            question: 'What is intelligence?',
            left: { questions: ['Q1'], model: 'left', usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 } },
            right: { questions: ['Q2'], model: 'right', usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 } },
            winner: 'left',
            reason: 'better quality',
          },
        }),
      })

      const data = await compareQuestionGenerations('What is intelligence?', { leftModel: 'a', rightModel: 'b' })
      expect(data.winner).toBe('left')
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/generate/compare'),
        expect.objectContaining({ method: 'POST' })
      )
    })

    it('getEvalStats and getModelPerformance read list payloads', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            promptVariants: [],
            recentRuns: [],
            tokenUsage: {
              total: { promptTokens: 1, completionTokens: 2, totalTokens: 3 },
              byOperation: {},
            },
            costGuard: {
              maxTokensPerSession: 1000,
              usedTokens: 1,
              remainingTokens: 999,
              warningThreshold: 0.8,
              usageRatio: 0.001,
              isNearLimit: false,
              isLimitExceeded: false,
            },
            modelPerformance: [],
            topModelBySeedType: {},
          },
        }),
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { entries: [{ model: 'm1', seedType: 'root', count: 2, avgScore: 0.9, lastScore: 0.9, lastUpdatedAt: null }] },
        }),
      })

      const stats = await getEvalStats()
      const perf = await getModelPerformance()

      expect(stats.tokenUsage.total.totalTokens).toBe(3)
      expect(perf[0].model).toBe('m1')
    })

    it('chat and concept endpoints return normalized payloads', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            data: {
              message: 'chat-response',
              model: 'chat-model',
              usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            data: {
              concepts: [
                {
                  id: 'c1',
                  text: 'dreams',
                  normalizedName: 'dreams',
                  category: 'psychology',
                  startIndex: 0,
                  endIndex: 6,
                },
              ],
              sourceText: 'dreams',
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            data: {
              conceptId: 'c1',
              normalizedName: 'dreams',
              summary: 'summary',
              context: 'context',
              relatedConcepts: ['sleep'],
            },
          }),
        })

      const message = await sendChatMessage('root', [{ role: 'user', content: 'hello' }])
      const concepts = await extractConcepts('dreams')
      const explanation = await explainConcept('c1', 'dreams', 'context')

      expect(message).toBe('chat-response')
      expect(concepts[0].normalizedName).toBe('dreams')
      expect(explanation.relatedConcepts).toEqual(['sleep'])
    })

    it('probe endpoints return typed payloads', async () => {
      const stashItems = [
        { id: 's1', type: 'note', content: 'note', metadata: { createdAt: Date.now() } },
      ] as any

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            data: {
              message: 'probe-chat',
              model: 'probe-model',
              usage: { promptTokens: 2, completionTokens: 3, totalTokens: 5 },
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            data: {
              brief: {
                problemStatement: 'problem',
                hypotheses: [],
                primaryExperiment: 'experiment',
                successMetrics: [],
                risks: [],
                recommendation: 'rec',
                nextExperiments: [],
              },
              markdown: '# brief',
              model: 'probe-model',
              usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            data: {
              suggestions: [{ title: 'A', hypothesis: 'H', metric: 'M' }],
              model: 'probe-model',
              usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
            },
          }),
        })

      const probeMessage = await sendProbeChatMessage([{ role: 'user', content: 'probe' }], stashItems)
      const brief = await exportProbeBrief(stashItems, 'direction')
      const suggestions = await suggestProbeExperiments([{ role: 'user', content: 'probe' }], stashItems)

      expect(probeMessage).toBe('probe-chat')
      expect(brief.brief.primaryExperiment).toBe('experiment')
      expect(suggestions.suggestions).toHaveLength(1)
    })
  })

  describe('error fallback parsing', () => {
    it('uses fallback error text when API error body is unreadable', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => {
          throw new Error('invalid json')
        },
      })

      await expect(sendChatMessage('root', [{ role: 'user', content: 'x' }])).rejects.toThrow(
        'Failed to send chat message'
      )
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
