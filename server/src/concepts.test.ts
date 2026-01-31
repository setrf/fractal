/**
 * Concept Extraction and Explanation Tests
 * =========================================
 * 
 * Tests for the concept extraction and explanation functionality.
 * Uses mocked LLM responses to test the parsing and validation logic.
 * 
 * NOTE: The concept extraction now computes indices using indexOf()
 * rather than trusting LLM-provided indices. Tests verify that:
 * 1. Concepts are found in the source text
 * 2. Categories are validated
 * 3. Overlapping concepts are removed
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Create mock functions first
const mockCreate = vi.fn()
const mockListModels = vi.fn().mockResolvedValue({ data: [{ id: 'test-model' }] })

// Mock the OpenAI client before importing inference
vi.mock('openai', () => {
  return {
    default: class MockOpenAI {
      chat = {
        completions: {
          create: mockCreate,
        },
      }
      models = {
        list: mockListModels,
      }
    },
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

describe('Concept Extraction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('extractConcepts', () => {
    it('should parse valid JSON response with concepts', async () => {
      // Note: LLM-provided indices are ignored - we use indexOf()
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify([
              {
                text: 'dream',  // Must match text in source
                normalizedName: 'dreams',
                category: 'psychology',
                startIndex: 0,  // Ignored - we compute via indexOf()
                endIndex: 100,  // Ignored
              },
              {
                text: 'sleep',
                normalizedName: 'sleep',
                category: 'science',
                startIndex: 0,  // Ignored
                endIndex: 100,  // Ignored
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
      expect(result.concepts[0].text).toBe('dream')
      expect(result.concepts[0].category).toBe('psychology')
      // Verify computed indices
      expect(result.concepts[0].startIndex).toBe(10)  // "dream" starts at index 10
      expect(result.concepts[0].endIndex).toBe(15)    // "dream" ends at index 15
      expect(result.concepts[1].text).toBe('sleep')
      expect(result.concepts[1].category).toBe('science')
      expect(result.concepts[1].startIndex).toBe(23)  // "sleep" starts at index 23
      expect(result.sourceText).toBe('Why do we dream during sleep?')
    })

    it('should filter out invalid categories', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify([
              {
                text: 'dream',
                normalizedName: 'dreams',
                category: 'invalid_category', // Invalid - will be filtered
              },
              {
                text: 'sleep',
                normalizedName: 'sleep',
                category: 'science', // Valid
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
      // "ionary" is a substring within "evolutionary" so indexOf() will find
      // overlapping positions - the second should be removed
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify([
              {
                text: 'evolutionary',
                normalizedName: 'evolution',
                category: 'science',
              },
              {
                text: 'ionary', // Overlaps (substring of evolutionary)
                normalizedName: 'evolution',
                category: 'science',
              },
              {
                text: 'byproduct',
                normalizedName: 'byproduct',
                category: 'abstract',
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

    it('should filter concepts not found in source text', async () => {
      // LLM indices are now ignored; concepts are found via indexOf()
      // Concepts that don't exist in source text are filtered out
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify([
              {
                text: 'valid',
                normalizedName: 'valid',
                category: 'abstract',
              },
              {
                text: 'nonexistent', // Not in source text
                normalizedName: 'nonexistent',
                category: 'abstract',
              },
              {
                text: 'missing', // Not in source text
                normalizedName: 'missing',
                category: 'abstract',
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
  beforeEach(() => {
    vi.clearAllMocks()
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
