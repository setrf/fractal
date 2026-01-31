/**
 * Concept Extraction and Explanation Tests
 * =========================================
 * 
 * Tests for the concept extraction and explanation functionality.
 * Uses mocked LLM responses to test the parsing and validation logic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the OpenAI client before importing inference
vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: vi.fn(),
        },
      },
      models: {
        list: vi.fn().mockResolvedValue({ data: [{ id: 'test-model' }] }),
      },
    })),
  }
})

// Mock weave
vi.mock('./weave-client.js', () => ({
  weave: {
    op: (fn: Function) => fn,
  },
}))

// Mock config
vi.mock('./config.js', () => ({
  config: {
    inferenceBaseUrl: 'https://test.api.com',
    wandbApiKey: 'test-key',
    defaultModel: 'test-model',
  },
}))

import OpenAI from 'openai'

describe('Concept Extraction', () => {
  let mockCreate: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    // Get reference to the mocked create function
    const MockOpenAI = OpenAI as unknown as ReturnType<typeof vi.fn>
    const instance = new MockOpenAI()
    mockCreate = instance.chat.completions.create
  })

  describe('extractConcepts', () => {
    it('should parse valid JSON response with concepts', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify([
              {
                text: 'dreams',
                normalizedName: 'dreams',
                category: 'psychology',
                startIndex: 10,
                endIndex: 16,
              },
              {
                text: 'sleep',
                normalizedName: 'sleep',
                category: 'science',
                startIndex: 24,
                endIndex: 29,
              },
            ]),
          },
        }],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150,
        },
      }
      
      mockCreate.mockResolvedValueOnce(mockResponse)
      
      // Dynamic import to get fresh module with mocks
      const { extractConcepts } = await import('./inference.js')
      
      const result = await extractConcepts('Why do we dream during sleep?')
      
      expect(result.concepts).toHaveLength(2)
      expect(result.concepts[0].text).toBe('dreams')
      expect(result.concepts[0].category).toBe('psychology')
      expect(result.concepts[1].text).toBe('sleep')
      expect(result.concepts[1].category).toBe('science')
      expect(result.sourceText).toBe('Why do we dream during sleep?')
    })

    it('should filter out invalid categories', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify([
              {
                text: 'dreams',
                normalizedName: 'dreams',
                category: 'invalid_category', // Invalid
                startIndex: 10,
                endIndex: 16,
              },
              {
                text: 'sleep',
                normalizedName: 'sleep',
                category: 'science', // Valid
                startIndex: 24,
                endIndex: 29,
              },
            ]),
          },
        }],
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      }
      
      mockCreate.mockResolvedValueOnce(mockResponse)
      
      const { extractConcepts } = await import('./inference.js')
      const result = await extractConcepts('Why do we dream during sleep?')
      
      expect(result.concepts).toHaveLength(1)
      expect(result.concepts[0].text).toBe('sleep')
    })

    it('should remove overlapping concepts', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify([
              {
                text: 'evolutionary',
                normalizedName: 'evolution',
                category: 'science',
                startIndex: 10,
                endIndex: 22,
              },
              {
                text: 'ionary', // Overlaps with previous
                normalizedName: 'evolution',
                category: 'science',
                startIndex: 16,
                endIndex: 22,
              },
              {
                text: 'byproduct',
                normalizedName: 'byproduct',
                category: 'abstract',
                startIndex: 23,
                endIndex: 32,
              },
            ]),
          },
        }],
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      }
      
      mockCreate.mockResolvedValueOnce(mockResponse)
      
      const { extractConcepts } = await import('./inference.js')
      const result = await extractConcepts('Is this evolutionary byproduct?')
      
      expect(result.concepts).toHaveLength(2)
      expect(result.concepts[0].text).toBe('evolutionary')
      expect(result.concepts[1].text).toBe('byproduct')
    })

    it('should handle empty response gracefully', async () => {
      const mockResponse = {
        choices: [{
          message: { content: '[]' },
        }],
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      }
      
      mockCreate.mockResolvedValueOnce(mockResponse)
      
      const { extractConcepts } = await import('./inference.js')
      const result = await extractConcepts('Hello world')
      
      expect(result.concepts).toHaveLength(0)
    })

    it('should handle malformed JSON gracefully', async () => {
      const mockResponse = {
        choices: [{
          message: { content: 'not valid json' },
        }],
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      }
      
      mockCreate.mockResolvedValueOnce(mockResponse)
      
      const { extractConcepts } = await import('./inference.js')
      const result = await extractConcepts('Test question')
      
      expect(result.concepts).toHaveLength(0)
    })

    it('should filter concepts with invalid indices', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify([
              {
                text: 'valid',
                normalizedName: 'valid',
                category: 'abstract',
                startIndex: 0,
                endIndex: 5,
              },
              {
                text: 'negative',
                normalizedName: 'negative',
                category: 'abstract',
                startIndex: -1, // Invalid
                endIndex: 5,
              },
              {
                text: 'overflow',
                normalizedName: 'overflow',
                category: 'abstract',
                startIndex: 0,
                endIndex: 1000, // Beyond text length
              },
            ]),
          },
        }],
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      }
      
      mockCreate.mockResolvedValueOnce(mockResponse)
      
      const { extractConcepts } = await import('./inference.js')
      const result = await extractConcepts('valid test')
      
      expect(result.concepts).toHaveLength(1)
      expect(result.concepts[0].text).toBe('valid')
    })
  })
})

describe('Concept Explanation', () => {
  let mockCreate: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    const MockOpenAI = OpenAI as unknown as ReturnType<typeof vi.fn>
    const instance = new MockOpenAI()
    mockCreate = instance.chat.completions.create
  })

  describe('explainConcept', () => {
    it('should parse valid explanation response', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              summary: 'Dreams are a series of images, ideas, emotions, and sensations.',
              context: 'In the context of sleep research, dreams help us understand consciousness.',
              relatedConcepts: ['REM sleep', 'consciousness', 'memory consolidation'],
            }),
          },
        }],
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      }
      
      mockCreate.mockResolvedValueOnce(mockResponse)
      
      const { explainConcept } = await import('./inference.js')
      const result = await explainConcept('c_123', 'dreams', 'Why do we dream?')
      
      expect(result.explanation.conceptId).toBe('c_123')
      expect(result.explanation.normalizedName).toBe('dreams')
      expect(result.explanation.summary).toContain('series of images')
      expect(result.explanation.relatedConcepts).toHaveLength(3)
    })

    it('should handle malformed JSON with fallback', async () => {
      const mockResponse = {
        choices: [{
          message: { content: 'not valid json' },
        }],
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      }
      
      mockCreate.mockResolvedValueOnce(mockResponse)
      
      const { explainConcept } = await import('./inference.js')
      const result = await explainConcept('c_456', 'evolution', 'How does evolution work?')
      
      expect(result.explanation.conceptId).toBe('c_456')
      expect(result.explanation.normalizedName).toBe('evolution')
      // Should have fallback values
      expect(result.explanation.summary).toBeTruthy()
      expect(result.explanation.context).toBeTruthy()
    })

    it('should limit related concepts to 5', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              summary: 'Test summary',
              context: 'Test context',
              relatedConcepts: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'],
            }),
          },
        }],
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      }
      
      mockCreate.mockResolvedValueOnce(mockResponse)
      
      const { explainConcept } = await import('./inference.js')
      const result = await explainConcept('c_789', 'test', 'Test question')
      
      expect(result.explanation.relatedConcepts).toHaveLength(5)
    })
  })
})
