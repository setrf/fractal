/**
 * Inference Module
 * ================
 * 
 * Handles LLM inference using W&B Inference API.
 * All calls are automatically traced via Weave.
 * 
 * W&B Inference provides:
 * - Access to open-source models (Llama, DeepSeek, Qwen, etc.)
 * - OpenAI-compatible API
 * - Automatic cost tracking
 */

import OpenAI from 'openai'
import { weave } from './weave-client.js'
import { config } from './config.js'

// Create OpenAI client configured for W&B Inference
const client = new OpenAI({
  baseURL: config.inferenceBaseUrl,
  apiKey: config.wandbApiKey,
})

/**
 * System prompt for generating related questions.
 */
const QUESTION_GENERATION_PROMPT = `You are a curious intellectual assistant that helps people explore ideas through questions.

Given a question, generate 3-5 related follow-up questions that:
1. Explore different angles or perspectives on the topic
2. Dig deeper into underlying assumptions
3. Connect to related concepts or domains
4. Challenge or expand the original question

Format your response as a JSON array of strings, each being a question.
Example: ["Why does X happen?", "What if Y instead?", "How does this relate to Z?"]

Only output the JSON array, nothing else.`

/**
 * Interface for generated questions response.
 */
export interface GeneratedQuestions {
  questions: string[]
  model: string
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

/**
 * Generate related questions for a given input question.
 * This function is wrapped with weave.op() for automatic tracing.
 */
export const generateRelatedQuestions = weave.op(
  async function generateRelatedQuestions(
    question: string,
    model: string = config.defaultModel
  ): Promise<GeneratedQuestions> {
    console.log(`[Inference] Generating questions for: "${question}"`)
    console.log(`[Inference] Using model: ${model}`)

    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: QUESTION_GENERATION_PROMPT },
        { role: 'user', content: question },
      ],
      temperature: 0.8,
      max_tokens: 500,
    })

    const content = response.choices[0]?.message?.content || '[]'
    
    // Parse the JSON response
    let questions: string[]
    try {
      questions = JSON.parse(content)
      if (!Array.isArray(questions)) {
        questions = [content]
      }
    } catch {
      // If parsing fails, split by newlines and clean up
      questions = content
        .split('\n')
        .map((q) => q.trim())
        .filter((q) => q.length > 0 && q.startsWith('"') === false)
      
      // Try to extract from partial JSON
      const matches = content.match(/"([^"]+\?)"/g)
      if (matches) {
        questions = matches.map((m) => m.replace(/"/g, ''))
      }
    }

    const result: GeneratedQuestions = {
      questions,
      model,
      usage: {
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
      },
    }

    console.log(`[Inference] Generated ${questions.length} questions`)
    console.log(`[Inference] Token usage: ${result.usage.totalTokens}`)

    return result
  }
)

/**
 * Get list of available models from W&B Inference.
 */
export const listModels = weave.op(async function listModels(): Promise<string[]> {
  console.log('[Inference] Fetching available models...')
  
  const response = await client.models.list()
  const models = response.data.map((m) => m.id)
  
  console.log(`[Inference] Found ${models.length} models`)
  
  return models
})

/**
 * Health check for the inference service.
 */
export async function checkInferenceHealth(): Promise<boolean> {
  try {
    await client.models.list()
    return true
  } catch {
    return false
  }
}

// ============================================
// CHAT FUNCTIONALITY
// ============================================

/**
 * System prompt for exploring a specific question in depth.
 */
const CHAT_SYSTEM_PROMPT = `You are a thoughtful intellectual companion helping someone explore a question deeply.

The user has "locked in" on a specific question they want to understand better. Your role is to:
1. Provide clear, insightful responses that illuminate the topic
2. Offer multiple perspectives when relevant
3. Use examples and analogies to make abstract concepts concrete
4. Ask clarifying questions when needed
5. Acknowledge uncertainty and the limits of knowledge
6. Encourage deeper thinking rather than just giving "answers"

Be conversational but substantive. Avoid being preachy or overly verbose.`

/**
 * Message type for chat conversations.
 */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

/**
 * Response from the chat endpoint.
 */
export interface ChatResponse {
  message: string
  model: string
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

/**
 * Send a chat message and get a response.
 * The rootQuestion provides context for the entire conversation.
 * 
 * @param rootQuestion - The original question being explored
 * @param messages - Conversation history
 * @param model - LLM model to use
 */
export const chat = weave.op(
  async function chat(
    rootQuestion: string,
    messages: ChatMessage[],
    model: string = config.defaultModel
  ): Promise<ChatResponse> {
    console.log(`[Chat] Processing message for question: "${rootQuestion.substring(0, 50)}..."`)
    console.log(`[Chat] Conversation length: ${messages.length} messages`)
    console.log(`[Chat] Using model: ${model}`)

    // Build the full message array with system context
    const fullMessages: ChatMessage[] = [
      { 
        role: 'system', 
        content: `${CHAT_SYSTEM_PROMPT}\n\nThe question being explored is: "${rootQuestion}"` 
      },
      ...messages,
    ]

    const response = await client.chat.completions.create({
      model,
      messages: fullMessages,
      temperature: 0.7,
      max_tokens: 1000,
    })

    const content = response.choices[0]?.message?.content || ''

    const result: ChatResponse = {
      message: content,
      model,
      usage: {
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
      },
    }

    console.log(`[Chat] Response length: ${content.length} chars`)
    console.log(`[Chat] Token usage: ${result.usage.totalTokens}`)

    return result
  }
)
