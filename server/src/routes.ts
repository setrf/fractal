/**
 * API Routes
 * ==========
 * 
 * Express router for the Fractal API.
 * 
 * Endpoints:
 * - GET  /health                  - Health check
 * - POST /api/generate            - Generate related questions
 * - POST /api/generate/compare    - A/B compare generations
 * - POST /api/chat                - Chat about a specific question
 * - POST /api/probe/chat          - Probe synthesis conversation
 * - POST /api/probe/brief         - Export PM brief from probe context
 * - POST /api/probe/experiments   - Suggest next experiments
 * - GET  /api/evals/stats         - Eval telemetry snapshot
 * - GET  /api/models              - List available models
 * - GET  /api/models/performance  - Model performance memory
 * - POST /api/concepts/extract    - Extract concepts from text
 * - POST /api/concepts/explain    - Get explanation for a concept
 */

import { Router, Request, Response } from 'express'
import {
  compareQuestionGenerations,
  generateRelatedQuestions,
  getEvalStats,
  getModelPerformanceMemory,
  chat,
  probeChat,
  generateProbeBrief,
  suggestProbeExperiments,
  listModels,
  checkInferenceHealth,
  extractConcepts,
  explainConcept,
  type ChatMessage,
  type ProbeStashItem,
} from './inference.js'

export const router = Router()

const MAX_QUESTION_LENGTH = 2000
const MAX_CONTEXT_LENGTH = 4000
const MAX_MESSAGE_LENGTH = 12000
const MAX_MESSAGES_PER_REQUEST = 100
const MAX_STASH_ITEMS_PER_REQUEST = 200
const MAX_MODEL_NAME_LENGTH = 200
const MAX_STASH_ITEM_CONTENT_LENGTH = 16000

type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string }

const ALLOWED_CHAT_ROLES = new Set<ChatMessage['role']>(['user', 'assistant', 'system'])
const ALLOWED_STASH_TYPES = new Set<ProbeStashItem['type']>([
  'highlight',
  'explanation',
  'question',
  'chat-message',
  'note',
])

function validateRequiredString(
  value: unknown,
  field: string,
  maxLength: number
): ValidationResult<string> {
  if (typeof value !== 'string') {
    return { ok: false, message: `${field} is required and must be a string` }
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return { ok: false, message: `${field} cannot be empty` }
  }

  if (trimmed.length > maxLength) {
    return { ok: false, message: `${field} is too long (max ${maxLength} chars)` }
  }

  return { ok: true, value: trimmed }
}

function validateOptionalModel(value: unknown): ValidationResult<string | undefined> {
  if (value === undefined || value === null || value === '') {
    return { ok: true, value: undefined }
  }

  if (typeof value !== 'string') {
    return { ok: false, message: 'model must be a string when provided' }
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return { ok: true, value: undefined }
  }

  if (trimmed.length > MAX_MODEL_NAME_LENGTH) {
    return { ok: false, message: `model is too long (max ${MAX_MODEL_NAME_LENGTH} chars)` }
  }

  return { ok: true, value: trimmed }
}

function validateMessages(messages: unknown): ValidationResult<ChatMessage[]> {
  if (!Array.isArray(messages)) {
    return { ok: false, message: 'messages is required and must be an array' }
  }

  if (messages.length > MAX_MESSAGES_PER_REQUEST) {
    return {
      ok: false,
      message: `messages exceeds maximum size (${MAX_MESSAGES_PER_REQUEST})`,
    }
  }

  const normalized: ChatMessage[] = []
  for (let index = 0; index < messages.length; index += 1) {
    const candidate = messages[index]
    if (!candidate || typeof candidate !== 'object') {
      return { ok: false, message: `messages[${index}] must be an object` }
    }

    const role = (candidate as { role?: unknown }).role
    const content = (candidate as { content?: unknown }).content

    if (typeof role !== 'string' || !ALLOWED_CHAT_ROLES.has(role as ChatMessage['role'])) {
      return { ok: false, message: `messages[${index}].role is invalid` }
    }

    if (typeof content !== 'string' || content.trim().length === 0) {
      return { ok: false, message: `messages[${index}].content must be a non-empty string` }
    }

    if (content.length > MAX_MESSAGE_LENGTH) {
      return {
        ok: false,
        message: `messages[${index}].content is too long (max ${MAX_MESSAGE_LENGTH} chars)`,
      }
    }

    normalized.push({ role: role as ChatMessage['role'], content })
  }

  return { ok: true, value: normalized }
}

function validateProbeStashItems(stashItems: unknown): ValidationResult<ProbeStashItem[]> {
  if (!Array.isArray(stashItems)) {
    return { ok: false, message: 'stashItems is required and must be an array' }
  }

  if (stashItems.length > MAX_STASH_ITEMS_PER_REQUEST) {
    return {
      ok: false,
      message: `stashItems exceeds maximum size (${MAX_STASH_ITEMS_PER_REQUEST})`,
    }
  }

  const normalized: ProbeStashItem[] = []
  for (let index = 0; index < stashItems.length; index += 1) {
    const candidate = stashItems[index]
    if (!candidate || typeof candidate !== 'object') {
      return { ok: false, message: `stashItems[${index}] must be an object` }
    }

    const id = (candidate as { id?: unknown }).id
    const type = (candidate as { type?: unknown }).type
    const content = (candidate as { content?: unknown }).content
    const metadata = (candidate as { metadata?: unknown }).metadata

    if (typeof id !== 'string' || id.trim().length === 0) {
      return { ok: false, message: `stashItems[${index}].id must be a non-empty string` }
    }

    if (typeof type !== 'string' || !ALLOWED_STASH_TYPES.has(type as ProbeStashItem['type'])) {
      return { ok: false, message: `stashItems[${index}].type is invalid` }
    }

    if (typeof content !== 'string' || content.trim().length === 0) {
      return { ok: false, message: `stashItems[${index}].content must be a non-empty string` }
    }

    if (content.length > MAX_STASH_ITEM_CONTENT_LENGTH) {
      return {
        ok: false,
        message: `stashItems[${index}].content is too long (max ${MAX_STASH_ITEM_CONTENT_LENGTH} chars)`,
      }
    }

    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      return { ok: false, message: `stashItems[${index}].metadata must be an object` }
    }

    normalized.push({
      id,
      type: type as ProbeStashItem['type'],
      content,
      metadata: metadata as ProbeStashItem['metadata'],
    })
  }

  return { ok: true, value: normalized }
}

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
    const questionValidation = validateRequiredString(
      req.body?.question,
      'question',
      MAX_QUESTION_LENGTH
    )
    if (!questionValidation.ok) {
      res.status(400).json({
        error: 'Bad Request',
        message: questionValidation.message,
      })
      return
    }

    const modelValidation = validateOptionalModel(req.body?.model)
    if (!modelValidation.ok) {
      res.status(400).json({
        error: 'Bad Request',
        message: modelValidation.message,
      })
      return
    }

    const question = questionValidation.value
    const model = modelValidation.value

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
 * Compare two generation runs side-by-side.
 *
 * Request body:
 * - question: string (required)
 * - leftModel: string (optional)
 * - rightModel: string (optional)
 * - leftPromptVariantId: string (optional)
 * - rightPromptVariantId: string (optional)
 */
router.post('/api/generate/compare', async (req: Request, res: Response) => {
  try {
    const questionValidation = validateRequiredString(
      req.body?.question,
      'question',
      MAX_QUESTION_LENGTH
    )
    if (!questionValidation.ok) {
      res.status(400).json({
        error: 'Bad Request',
        message: questionValidation.message,
      })
      return
    }

    const leftModelValidation = validateOptionalModel(req.body?.leftModel)
    if (!leftModelValidation.ok) {
      res.status(400).json({
        error: 'Bad Request',
        message: leftModelValidation.message,
      })
      return
    }

    const rightModelValidation = validateOptionalModel(req.body?.rightModel)
    if (!rightModelValidation.ok) {
      res.status(400).json({
        error: 'Bad Request',
        message: rightModelValidation.message,
      })
      return
    }

    const leftPromptVariantValidation = validateOptionalModel(req.body?.leftPromptVariantId)
    if (!leftPromptVariantValidation.ok) {
      res.status(400).json({
        error: 'Bad Request',
        message: leftPromptVariantValidation.message,
      })
      return
    }

    const rightPromptVariantValidation = validateOptionalModel(req.body?.rightPromptVariantId)
    if (!rightPromptVariantValidation.ok) {
      res.status(400).json({
        error: 'Bad Request',
        message: rightPromptVariantValidation.message,
      })
      return
    }

    const result = await compareQuestionGenerations(
      questionValidation.value,
      leftModelValidation.value,
      rightModelValidation.value,
      leftPromptVariantValidation.value,
      rightPromptVariantValidation.value
    )

    res.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error('[API] Error comparing generations:', error)
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
    const rootQuestionValidation = validateRequiredString(
      req.body?.rootQuestion,
      'rootQuestion',
      MAX_QUESTION_LENGTH
    )
    if (!rootQuestionValidation.ok) {
      res.status(400).json({
        error: 'Bad Request',
        message: rootQuestionValidation.message,
      })
      return
    }

    const messagesValidation = validateMessages(req.body?.messages)
    if (!messagesValidation.ok) {
      res.status(400).json({
        error: 'Bad Request',
        message: messagesValidation.message,
      })
      return
    }

    const modelValidation = validateOptionalModel(req.body?.model)
    if (!modelValidation.ok) {
      res.status(400).json({
        error: 'Bad Request',
        message: modelValidation.message,
      })
      return
    }

    const rootQuestion = rootQuestionValidation.value
    const messages = messagesValidation.value
    const model = modelValidation.value

    console.log(`[API] POST /api/chat - Question: "${rootQuestion.substring(0, 50)}..."`)

    const result = await chat(rootQuestion, messages, model)

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
 * Probe chat endpoint for synthesis conversations.
 * 
 * Request body:
 * - messages: ChatMessage[] (required) - Conversation history
 * - stashItems: ProbeStashItem[] (required) - Selected stash items for context
 * - model: string (optional) - Model to use
 * 
 * Response:
 * - message: string - AI response
 * - model: string - Model used
 * - usage: object - Token usage statistics
 */
router.post('/api/probe/chat', async (req: Request, res: Response) => {
  try {
    const messagesValidation = validateMessages(req.body?.messages)
    if (!messagesValidation.ok) {
      res.status(400).json({
        error: 'Bad Request',
        message: messagesValidation.message,
      })
      return
    }

    const stashItemsValidation = validateProbeStashItems(req.body?.stashItems)
    if (!stashItemsValidation.ok) {
      res.status(400).json({
        error: 'Bad Request',
        message: stashItemsValidation.message,
      })
      return
    }

    const modelValidation = validateOptionalModel(req.body?.model)
    if (!modelValidation.ok) {
      res.status(400).json({
        error: 'Bad Request',
        message: modelValidation.message,
      })
      return
    }

    const messages = messagesValidation.value
    const stashItems = stashItemsValidation.value
    const model = modelValidation.value

    console.log(`[API] POST /api/probe/chat - ${stashItems.length} stash items, ${messages.length} messages`)

    const result = await probeChat(messages, stashItems, model)

    res.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error('[API] Error in probe chat:', error)
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

/**
 * Export a structured PM brief from selected probe context.
 */
router.post('/api/probe/brief', async (req: Request, res: Response) => {
  try {
    const stashItemsValidation = validateProbeStashItems(req.body?.stashItems)
    if (!stashItemsValidation.ok) {
      res.status(400).json({
        error: 'Bad Request',
        message: stashItemsValidation.message,
      })
      return
    }

    const directionValidation = validateRequiredString(
      req.body?.direction,
      'direction',
      MAX_CONTEXT_LENGTH
    )
    if (!directionValidation.ok) {
      res.status(400).json({
        error: 'Bad Request',
        message: directionValidation.message,
      })
      return
    }

    const modelValidation = validateOptionalModel(req.body?.model)
    if (!modelValidation.ok) {
      res.status(400).json({
        error: 'Bad Request',
        message: modelValidation.message,
      })
      return
    }

    const result = await generateProbeBrief(
      stashItemsValidation.value,
      directionValidation.value,
      modelValidation.value
    )

    res.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error('[API] Error exporting probe brief:', error)
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

/**
 * Suggest next experiments from probe context + conversation.
 */
router.post('/api/probe/experiments', async (req: Request, res: Response) => {
  try {
    const messagesValidation = validateMessages(req.body?.messages)
    if (!messagesValidation.ok) {
      res.status(400).json({
        error: 'Bad Request',
        message: messagesValidation.message,
      })
      return
    }

    const stashItemsValidation = validateProbeStashItems(req.body?.stashItems)
    if (!stashItemsValidation.ok) {
      res.status(400).json({
        error: 'Bad Request',
        message: stashItemsValidation.message,
      })
      return
    }

    const modelValidation = validateOptionalModel(req.body?.model)
    if (!modelValidation.ok) {
      res.status(400).json({
        error: 'Bad Request',
        message: modelValidation.message,
      })
      return
    }

    const result = await suggestProbeExperiments(
      messagesValidation.value,
      stashItemsValidation.value,
      modelValidation.value
    )

    res.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error('[API] Error suggesting probe experiments:', error)
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

/**
 * Get current eval telemetry snapshot.
 */
router.get('/api/evals/stats', async (_req: Request, res: Response) => {
  try {
    const stats = await getEvalStats()
    res.json({
      success: true,
      data: stats,
    })
  } catch (error) {
    console.error('[API] Error fetching eval stats:', error)
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

/**
 * Get persisted model-performance memory by seed type.
 */
router.get('/api/models/performance', async (_req: Request, res: Response) => {
  try {
    const performance = await getModelPerformanceMemory()
    res.json({
      success: true,
      data: {
        entries: performance,
      },
    })
  } catch (error) {
    console.error('[API] Error fetching model performance:', error)
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
    const textValidation = validateRequiredString(req.body?.text, 'text', MAX_CONTEXT_LENGTH)
    if (!textValidation.ok) {
      res.status(400).json({
        error: 'Bad Request',
        message: textValidation.message,
      })
      return
    }

    const modelValidation = validateOptionalModel(req.body?.model)
    if (!modelValidation.ok) {
      res.status(400).json({
        error: 'Bad Request',
        message: modelValidation.message,
      })
      return
    }

    const text = textValidation.value
    const model = modelValidation.value

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
    const conceptIdValidation = validateRequiredString(req.body?.conceptId, 'conceptId', 200)
    if (!conceptIdValidation.ok) {
      res.status(400).json({
        error: 'Bad Request',
        message: conceptIdValidation.message,
      })
      return
    }

    const conceptNameValidation = validateRequiredString(req.body?.conceptName, 'conceptName', 200)
    if (!conceptNameValidation.ok) {
      res.status(400).json({
        error: 'Bad Request',
        message: conceptNameValidation.message,
      })
      return
    }

    const questionContextValidation = validateRequiredString(
      req.body?.questionContext,
      'questionContext',
      MAX_CONTEXT_LENGTH
    )
    if (!questionContextValidation.ok) {
      res.status(400).json({
        error: 'Bad Request',
        message: questionContextValidation.message,
      })
      return
    }

    const modelValidation = validateOptionalModel(req.body?.model)
    if (!modelValidation.ok) {
      res.status(400).json({
        error: 'Bad Request',
        message: modelValidation.message,
      })
      return
    }

    const conceptId = conceptIdValidation.value
    const conceptName = conceptNameValidation.value
    const questionContext = questionContextValidation.value
    const model = modelValidation.value

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
