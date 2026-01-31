/**
 * API Routes
 * ==========
 * 
 * Express router for the Fractal API.
 * 
 * Endpoints:
 * - GET  /health                  - Health check
 * - POST /api/generate            - Generate related questions
 * - POST /api/chat                - Chat about a specific question
 * - GET  /api/models              - List available models
 * - POST /api/concepts/extract    - Extract concepts from text
 * - POST /api/concepts/explain    - Get explanation for a concept
 */

import { Router, Request, Response } from 'express'
import {
  generateRelatedQuestions,
  chat,
  listModels,
  checkInferenceHealth,
  extractConcepts,
  explainConcept,
  type ChatMessage,
} from './inference.js'

export const router = Router()

/**
 * Health check endpoint.
 */
router.get('/health', async (_req: Request, res: Response) => {
  const inferenceHealthy = await checkInferenceHealth()
  
  const health = {
    status: inferenceHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    services: {
      inference: inferenceHealthy ? 'up' : 'down',
    },
  }
  
  res.status(inferenceHealthy ? 200 : 503).json(health)
})

/**
 * Generate related questions endpoint.
 * 
 * Request body:
 * - question: string (required) - The input question
 * - model: string (optional) - Model to use for generation
 * 
 * Response:
 * - questions: string[] - Generated related questions
 * - model: string - Model used
 * - usage: object - Token usage statistics
 */
router.post('/api/generate', async (req: Request, res: Response) => {
  try {
    const { question, model } = req.body

    if (!question || typeof question !== 'string') {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Question is required and must be a string',
      })
      return
    }

    if (question.trim().length === 0) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Question cannot be empty',
      })
      return
    }

    console.log(`[API] POST /api/generate - Question: "${question.substring(0, 50)}..."`)

    const result = await generateRelatedQuestions(question, model)

    res.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error('[API] Error generating questions:', error)
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

/**
 * Chat endpoint for exploring a specific question.
 * 
 * Request body:
 * - rootQuestion: string (required) - The question being explored
 * - messages: ChatMessage[] (required) - Conversation history
 * - model: string (optional) - Model to use
 * 
 * Response:
 * - message: string - AI response
 * - model: string - Model used
 * - usage: object - Token usage statistics
 */
router.post('/api/chat', async (req: Request, res: Response) => {
  try {
    const { rootQuestion, messages, model } = req.body

    if (!rootQuestion || typeof rootQuestion !== 'string') {
      res.status(400).json({
        error: 'Bad Request',
        message: 'rootQuestion is required and must be a string',
      })
      return
    }

    if (!messages || !Array.isArray(messages)) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'messages is required and must be an array',
      })
      return
    }

    // Validate message format
    for (const msg of messages) {
      if (!msg.role || !msg.content) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Each message must have role and content',
        })
        return
      }
    }

    console.log(`[API] POST /api/chat - Question: "${rootQuestion.substring(0, 50)}..."`)

    const result = await chat(rootQuestion, messages as ChatMessage[], model)

    res.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error('[API] Error in chat:', error)
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

/**
 * List available models endpoint.
 */
router.get('/api/models', async (_req: Request, res: Response) => {
  try {
    console.log('[API] GET /api/models')
    
    const models = await listModels()
    
    res.json({
      success: true,
      data: { models },
    })
  } catch (error) {
    console.error('[API] Error listing models:', error)
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

// ============================================
// CONCEPT EXTRACTION ENDPOINTS
// ============================================

/**
 * Extract concepts from question text.
 * 
 * Request body:
 * - text: string (required) - The text to extract concepts from
 * - model: string (optional) - Model to use for extraction
 * 
 * Response:
 * - concepts: ExtractedConcept[] - Array of extracted concepts
 * - sourceText: string - The original text
 * - model: string - Model used
 * - usage: object - Token usage statistics
 */
router.post('/api/concepts/extract', async (req: Request, res: Response) => {
  try {
    const { text, model } = req.body

    if (!text || typeof text !== 'string') {
      res.status(400).json({
        error: 'Bad Request',
        message: 'text is required and must be a string',
      })
      return
    }

    if (text.trim().length === 0) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'text cannot be empty',
      })
      return
    }

    console.log(`[API] POST /api/concepts/extract - Text: "${text.substring(0, 50)}..."`)

    const result = await extractConcepts(text, model)

    res.json({
      success: true,
      data: {
        concepts: result.concepts,
        sourceText: result.sourceText,
      },
    })
  } catch (error) {
    console.error('[API] Error extracting concepts:', error)
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

/**
 * Get explanation for a concept in context.
 * 
 * Request body:
 * - conceptId: string (required) - ID of the concept
 * - conceptName: string (required) - Name/normalized name of the concept
 * - questionContext: string (required) - The question context for the concept
 * - model: string (optional) - Model to use for explanation
 * 
 * Response:
 * - explanation: ConceptExplanation - The generated explanation
 * - model: string - Model used
 * - usage: object - Token usage statistics
 */
router.post('/api/concepts/explain', async (req: Request, res: Response) => {
  try {
    const { conceptId, conceptName, questionContext, model } = req.body

    if (!conceptId || typeof conceptId !== 'string') {
      res.status(400).json({
        error: 'Bad Request',
        message: 'conceptId is required and must be a string',
      })
      return
    }

    if (!conceptName || typeof conceptName !== 'string') {
      res.status(400).json({
        error: 'Bad Request',
        message: 'conceptName is required and must be a string',
      })
      return
    }

    if (!questionContext || typeof questionContext !== 'string') {
      res.status(400).json({
        error: 'Bad Request',
        message: 'questionContext is required and must be a string',
      })
      return
    }

    console.log(`[API] POST /api/concepts/explain - Concept: "${conceptName}"`)

    const result = await explainConcept(conceptId, conceptName, questionContext, model)

    res.json({
      success: true,
      data: result.explanation,
    })
  } catch (error) {
    console.error('[API] Error explaining concept:', error)
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})
