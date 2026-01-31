/**
 * API Routes
 * ==========
 * 
 * Express router for the Fractal API.
 * 
 * Endpoints:
 * - GET  /health           - Health check
 * - POST /api/generate     - Generate related questions
 * - GET  /api/models       - List available models
 */

import { Router, Request, Response } from 'express'
import {
  generateRelatedQuestions,
  listModels,
  checkInferenceHealth,
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
