import express from 'express'
import type { AddressInfo } from 'node:net'
import { request as httpRequest } from 'node:http'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const inferenceMocks = vi.hoisted(() => ({
  compareQuestionGenerations: vi.fn(),
  generateRelatedQuestions: vi.fn(),
  getEvalStats: vi.fn(),
  getModelPerformanceMemory: vi.fn(),
  chat: vi.fn(),
  probeChat: vi.fn(),
  generateProbeBrief: vi.fn(),
  suggestProbeExperiments: vi.fn(),
  listModels: vi.fn(),
  checkInferenceHealth: vi.fn(),
  extractConcepts: vi.fn(),
  explainConcept: vi.fn(),
}))

vi.mock('./inference.js', () => inferenceMocks)

import { router } from './routes.js'

interface HttpResponse<T = unknown> {
  status: number
  body: T
}

interface HttpRequestOptions {
  method?: string
  headers?: Record<string, string>
  body?: string
}

async function withServer(run: (baseUrl: string) => Promise<void>) {
  const app = express()
  app.use(express.json())
  app.use(router)

  const server = app.listen(0, '127.0.0.1')
  await new Promise<void>((resolve) => {
    server.once('listening', () => resolve())
  })

  const address = server.address() as AddressInfo
  const baseUrl = `http://127.0.0.1:${address.port}`

  try {
    await run(baseUrl)
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error)
        else resolve()
      })
    })
  }
}

async function requestJson<T = unknown>(
  baseUrl: string,
  path: string,
  options?: HttpRequestOptions
): Promise<HttpResponse<T>> {
  const url = new URL(path, baseUrl)
  const method = options?.method ?? 'GET'
  const headers = (options?.headers ?? {}) as Record<string, string>
  const payload = typeof options?.body === 'string' ? options.body : undefined

  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        hostname: url.hostname,
        port: url.port,
        path: `${url.pathname}${url.search}`,
        method,
        headers,
      },
      (res) => {
        let raw = ''
        res.setEncoding('utf8')
        res.on('data', (chunk) => {
          raw += chunk
        })
        res.on('end', () => {
          try {
            const body = raw ? (JSON.parse(raw) as T) : (null as T)
            resolve({
              status: res.statusCode ?? 0,
              body,
            })
          } catch (error) {
            reject(error)
          }
        })
      }
    )

    req.on('error', reject)
    if (payload) req.write(payload)
    req.end()
  })
}

describe('routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    inferenceMocks.checkInferenceHealth.mockResolvedValue(true)
    inferenceMocks.generateRelatedQuestions.mockResolvedValue({
      questions: ['Q1'],
      model: 'test-model',
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
    })
    inferenceMocks.compareQuestionGenerations.mockResolvedValue({
      left: { questions: ['L1'] },
      right: { questions: ['R1'] },
    })
    inferenceMocks.chat.mockResolvedValue({
      message: 'assistant response',
      model: 'test-model',
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
    })
    inferenceMocks.probeChat.mockResolvedValue({
      message: 'probe response',
      model: 'test-model',
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
    })
    inferenceMocks.generateProbeBrief.mockResolvedValue({
      markdown: '# Brief',
      model: 'test-model',
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
    })
    inferenceMocks.suggestProbeExperiments.mockResolvedValue({
      experiments: [{ title: 'Test idea', rationale: 'Because' }],
      model: 'test-model',
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
    })
    inferenceMocks.listModels.mockResolvedValue(['model-a'])
    inferenceMocks.getEvalStats.mockResolvedValue({
      totalSamples: 0,
      averageScore: 0,
      averageConfidence: 0,
      averageUncertainty: 0,
      averageLatencyMs: 0,
      tokenBudget: {
        maxTokensPerSession: 40_000,
        warningThreshold: 0.8,
        consumed: 0,
        remaining: 40_000,
        warning: false,
      },
      latestSample: null,
      byPromptVariant: [],
      byModelSeed: [],
    })
    inferenceMocks.getModelPerformanceMemory.mockResolvedValue([])
    inferenceMocks.extractConcepts.mockResolvedValue({
      concepts: [],
      sourceText: 'source text',
      model: 'test-model',
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
    })
    inferenceMocks.explainConcept.mockResolvedValue({
      explanation: {
        conceptId: 'c1',
        normalizedName: 'concept',
        summary: 'summary',
        context: 'context',
        relatedConcepts: [],
      },
      model: 'test-model',
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns healthy status when inference health check passes', async () => {
    await withServer(async (baseUrl) => {
      const response = await requestJson(baseUrl, '/health')
      expect(response.status).toBe(200)
      expect((response.body as { status: string }).status).toBe('healthy')
    })
  })

  it('returns degraded status when inference health check fails', async () => {
    inferenceMocks.checkInferenceHealth.mockResolvedValue(false)

    await withServer(async (baseUrl) => {
      const response = await requestJson(baseUrl, '/health')
      expect(response.status).toBe(503)
      expect((response.body as { status: string }).status).toBe('degraded')
    })
  })

  it('validates required fields for generate endpoint', async () => {
    await withServer(async (baseUrl) => {
      const response = await requestJson<{ message: string }>(baseUrl, '/api/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      })

      expect(response.status).toBe(400)
      expect(response.body.message).toContain('question')
      expect(inferenceMocks.generateRelatedQuestions).not.toHaveBeenCalled()
    })
  })

  it('trims and forwards question/model payload for generate endpoint', async () => {
    await withServer(async (baseUrl) => {
      const response = await requestJson(baseUrl, '/api/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          question: '  Why do we dream?  ',
          model: '  model-a  ',
        }),
      })

      expect(response.status).toBe(200)
      expect(inferenceMocks.generateRelatedQuestions).toHaveBeenCalledWith('Why do we dream?', 'model-a')
    })
  })

  it('rejects invalid compare-model payload types', async () => {
    await withServer(async (baseUrl) => {
      const response = await requestJson<{ message: string }>(baseUrl, '/api/generate/compare', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          question: 'Question',
          leftModel: 123,
        }),
      })

      expect(response.status).toBe(400)
      expect(response.body.message).toContain('model')
      expect(inferenceMocks.compareQuestionGenerations).not.toHaveBeenCalled()
    })
  })

  it('rejects invalid chat message schema', async () => {
    await withServer(async (baseUrl) => {
      const response = await requestJson<{ message: string }>(baseUrl, '/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          rootQuestion: 'Question',
          messages: [{ role: 'invalid', content: 'hello' }],
        }),
      })

      expect(response.status).toBe(400)
      expect(response.body.message).toContain('messages[0].role')
      expect(inferenceMocks.chat).not.toHaveBeenCalled()
    })
  })

  it('rejects chat payload when messages exceed allowed count', async () => {
    await withServer(async (baseUrl) => {
      const messages = Array.from({ length: 101 }, (_, index) => ({
        role: 'user',
        content: `message ${index}`,
      }))

      const response = await requestJson<{ message: string }>(baseUrl, '/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          rootQuestion: 'Question',
          messages,
        }),
      })

      expect(response.status).toBe(400)
      expect(response.body.message).toContain('messages exceeds maximum size')
    })
  })

  it('rejects invalid stash metadata in probe chat payload', async () => {
    await withServer(async (baseUrl) => {
      const response = await requestJson<{ message: string }>(baseUrl, '/api/probe/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'hello' }],
          stashItems: [
            {
              id: 's1',
              type: 'question',
              content: 'content',
              metadata: 'not-an-object',
            },
          ],
        }),
      })

      expect(response.status).toBe(400)
      expect(response.body.message).toContain('metadata must be an object')
      expect(inferenceMocks.probeChat).not.toHaveBeenCalled()
    })
  })

  it('rejects empty direction for probe brief endpoint', async () => {
    await withServer(async (baseUrl) => {
      const response = await requestJson<{ message: string }>(baseUrl, '/api/probe/brief', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          stashItems: [],
          direction: '   ',
        }),
      })

      expect(response.status).toBe(400)
      expect(response.body.message).toContain('direction')
      expect(inferenceMocks.generateProbeBrief).not.toHaveBeenCalled()
    })
  })

  it('rejects missing text for concept extraction endpoint', async () => {
    await withServer(async (baseUrl) => {
      const response = await requestJson<{ message: string }>(baseUrl, '/api/concepts/extract', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          text: '',
        }),
      })

      expect(response.status).toBe(400)
      expect(response.body.message).toContain('text')
      expect(inferenceMocks.extractConcepts).not.toHaveBeenCalled()
    })
  })

  it('validates required concept explain fields and forwards normalized payload', async () => {
    await withServer(async (baseUrl) => {
      const response = await requestJson(baseUrl, '/api/concepts/explain', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          conceptId: '  c1  ',
          conceptName: '  Consciousness  ',
          questionContext: '  What is consciousness?  ',
          model: '',
        }),
      })

      expect(response.status).toBe(200)
      expect(inferenceMocks.explainConcept).toHaveBeenCalledWith(
        'c1',
        'Consciousness',
        'What is consciousness?',
        undefined
      )
    })
  })

  it('returns 500 when downstream generation throws', async () => {
    inferenceMocks.generateRelatedQuestions.mockRejectedValueOnce(new Error('downstream error'))

    await withServer(async (baseUrl) => {
      const response = await requestJson<{ message: string }>(baseUrl, '/api/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          question: 'Why do we dream?',
        }),
      })

      expect(response.status).toBe(500)
      expect(response.body.message).toContain('downstream error')
    })
  })
})
