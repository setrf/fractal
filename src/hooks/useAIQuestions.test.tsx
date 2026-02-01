/**
 * @fileoverview Tests for the useAIQuestions hook.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useAIQuestions } from './useAIQuestions'
import * as api from '../api'

// Mock the API module
vi.mock('../api', () => ({
  generateQuestions: vi.fn(),
  isApiAvailable: vi.fn(),
}))

describe('useAIQuestions Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Initial State', () => {
    it('should start with isLoading as false', () => {
      console.log('[TEST] Checking initial isLoading state')
      
      const { result } = renderHook(() => useAIQuestions())
      
      console.log('[TEST] Initial isLoading:', result.current.isLoading)
      expect(result.current.isLoading).toBe(false)
    })

    it('should start with no error', () => {
      console.log('[TEST] Checking initial error state')
      
      const { result } = renderHook(() => useAIQuestions())
      
      console.log('[TEST] Initial error:', result.current.error)
      expect(result.current.error).toBeNull()
    })

    it('should start with isAvailable as true', () => {
      console.log('[TEST] Checking initial isAvailable state')
      
      const { result } = renderHook(() => useAIQuestions())
      
      console.log('[TEST] Initial isAvailable:', result.current.isAvailable)
      expect(result.current.isAvailable).toBe(true)
    })

    it('should provide generate function', () => {
      console.log('[TEST] Checking generate function exists')
      
      const { result } = renderHook(() => useAIQuestions())
      
      expect(typeof result.current.generate).toBe('function')
      console.log('[TEST] generate is a function: true')
    })

    it('should provide checkAvailability function', () => {
      console.log('[TEST] Checking checkAvailability function exists')
      
      const { result } = renderHook(() => useAIQuestions())
      
      expect(typeof result.current.checkAvailability).toBe('function')
      console.log('[TEST] checkAvailability is a function: true')
    })
  })

  describe('generate()', () => {
    it('should set isLoading to true during generation', async () => {
      console.log('[TEST] Testing isLoading during generation')
      
      let resolveGenerate: (value: { questions: string[]; meta: null }) => void
      vi.mocked(api.generateQuestions).mockImplementation(
        () => new Promise((resolve) => { resolveGenerate = resolve })
      )

      const { result } = renderHook(() => useAIQuestions())
      
      // Start generation without awaiting
      act(() => {
        result.current.generate('Test question?')
      })
      
      console.log('[TEST] isLoading during call:', result.current.isLoading)
      expect(result.current.isLoading).toBe(true)
      
      // Resolve the promise
      await act(async () => {
        resolveGenerate({ questions: ['Q1?', 'Q2?'], meta: null })
      })
      
      console.log('[TEST] isLoading after call:', result.current.isLoading)
      expect(result.current.isLoading).toBe(false)
    })

    it('should return generated questions', async () => {
      console.log('[TEST] Testing question generation')
      
      const mockQuestions = ['Question A?', 'Question B?', 'Question C?']
      vi.mocked(api.generateQuestions).mockResolvedValue({ questions: mockQuestions, meta: null })

      const { result } = renderHook(() => useAIQuestions())
      
      let questions: string[] = []
      await act(async () => {
        const resultValue = await result.current.generate('What is AI?')
        questions = resultValue.questions
      })
      
      console.log('[TEST] Generated questions:', questions)
      expect(questions).toEqual(mockQuestions)
    })

    it('should call API with correct question', async () => {
      console.log('[TEST] Testing API call parameters')
      
      vi.mocked(api.generateQuestions).mockResolvedValue({ questions: [], meta: null })

      const { result } = renderHook(() => useAIQuestions())
      
      await act(async () => {
        await result.current.generate('What is consciousness?')
      })
      
      expect(api.generateQuestions).toHaveBeenCalledWith('What is consciousness?')
      console.log('[TEST] API called with correct question')
    })

    it('should set error on failure', async () => {
      console.log('[TEST] Testing error handling')
      
      vi.mocked(api.generateQuestions).mockRejectedValue(new Error('API Error'))

      const { result } = renderHook(() => useAIQuestions())
      
      await act(async () => {
        await result.current.generate('Will this fail?')
      })
      
      console.log('[TEST] Error after failure:', result.current.error)
      expect(result.current.error).toBe('API Error')
    })

    it('should return empty array on failure', async () => {
      console.log('[TEST] Testing return value on failure')
      
      vi.mocked(api.generateQuestions).mockRejectedValue(new Error('API Error'))

      const { result } = renderHook(() => useAIQuestions())
      
      let questions: string[] = []
      await act(async () => {
        const resultValue = await result.current.generate('Will this fail?')
        questions = resultValue.questions
      })
      
      console.log('[TEST] Questions on failure:', questions)
      expect(questions).toEqual([])
    })

    it('should set isAvailable to false on failure', async () => {
      console.log('[TEST] Testing isAvailable after failure')
      
      vi.mocked(api.generateQuestions).mockRejectedValue(new Error('API Error'))

      const { result } = renderHook(() => useAIQuestions())
      
      expect(result.current.isAvailable).toBe(true)
      
      await act(async () => {
        await result.current.generate('Will this fail?')
      })
      
      console.log('[TEST] isAvailable after failure:', result.current.isAvailable)
      expect(result.current.isAvailable).toBe(false)
    })

    it('should clear error on subsequent successful call', async () => {
      console.log('[TEST] Testing error clearing')
      
      vi.mocked(api.generateQuestions)
        .mockRejectedValueOnce(new Error('First call failed'))
        .mockResolvedValueOnce({ questions: ['Success!'], meta: null })

      const { result } = renderHook(() => useAIQuestions())
      
      // First call - fails
      await act(async () => {
        await result.current.generate('First?')
      })
      console.log('[TEST] Error after first call:', result.current.error)
      expect(result.current.error).toBe('First call failed')
      
      // Second call - succeeds
      await act(async () => {
        await result.current.generate('Second?')
      })
      console.log('[TEST] Error after second call:', result.current.error)
      expect(result.current.error).toBeNull()
    })
  })

  describe('checkAvailability()', () => {
    it('should update isAvailable based on API status', async () => {
      console.log('[TEST] Testing checkAvailability')
      
      vi.mocked(api.isApiAvailable).mockResolvedValue(true)

      const { result } = renderHook(() => useAIQuestions())
      
      let available = false
      await act(async () => {
        available = await result.current.checkAvailability()
      })
      
      console.log('[TEST] Availability check result:', available)
      expect(available).toBe(true)
      expect(result.current.isAvailable).toBe(true)
    })

    it('should set isAvailable to false when API is down', async () => {
      console.log('[TEST] Testing checkAvailability when API is down')
      
      vi.mocked(api.isApiAvailable).mockResolvedValue(false)

      const { result } = renderHook(() => useAIQuestions())
      
      await act(async () => {
        await result.current.checkAvailability()
      })
      
      console.log('[TEST] isAvailable when API down:', result.current.isAvailable)
      expect(result.current.isAvailable).toBe(false)
    })
  })
})
