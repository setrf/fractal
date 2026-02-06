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

const isTestMode = process.env.NODE_ENV === 'test'

// Create OpenAI client configured for W&B Inference
const client = new OpenAI({
  baseURL: config.inferenceBaseUrl,
  apiKey: config.wandbApiKey,
})

/**
 * Robustly extract and parse JSON from a string that may contain markdown or conversational filler.
 */
function parseRobustJson<T>(content: string, fallback: T): T {
  let cleaned = content.trim()

  // Remove <think> blocks if present
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/g, '').trim()

  // Try to find JSON in markdown code blocks
  const jsonBlockMatch = cleaned.match(/```json\s*([\s\S]*?)\s*```/)
  if (jsonBlockMatch) {
    cleaned = jsonBlockMatch[1].trim()
  } else {
    // Try to find any block starting with [ or { and ending with ] or }
    const firstBracket = cleaned.indexOf('[')
    const firstBrace = cleaned.indexOf('{')
    const lastBracket = cleaned.lastIndexOf(']')
    const lastBrace = cleaned.lastIndexOf('}')

    const start = (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) ? firstBracket : firstBrace
    const end = (lastBracket !== -1 && (lastBrace === -1 || lastBracket > lastBrace)) ? lastBracket : lastBrace

    if (start !== -1 && end !== -1 && end > start) {
      cleaned = cleaned.slice(start, end + 1)
    }
  }

  try {
    return JSON.parse(cleaned) as T
  } catch {
    if (!isTestMode) {
      console.warn('[Inference] JSON parse failed, returning fallback. Content snippet:', content.substring(0, 100))
    }
    return fallback
  }
}

/**
 * Prompt variants for generating related questions.
 * We use a lightweight self-improving loop to pick the best variant over time.
 */
interface PromptVariant {
  id: string
  label: string
  prompt: string
}

const QUESTION_PROMPT_VARIANTS: PromptVariant[] = [
  {
    id: 'v1-balanced',
    label: 'Balanced',
    prompt: `You are a curious intellectual assistant that helps people explore ideas through questions.

Given a question, generate 3-5 related follow-up questions that:
1. Explore different angles or perspectives on the topic
2. Dig deeper into underlying assumptions
3. Connect to related concepts or domains
4. Challenge or expand the original question

Format your response as a JSON array of strings, each being a question.
Example: ["Why does X happen?", "What if Y instead?", "How does this relate to Z?"]

Only output the JSON array, nothing else.`,
  },
  {
    id: 'v2-divergent',
    label: 'Divergent',
    prompt: `You are a creative research companion. Generate 3-5 provocative, divergent follow-up questions that:
1. Explore surprising angles or counterfactuals
2. Surface hidden assumptions
3. Bridge into adjacent domains
4. Invite deeper investigation

Return a JSON array of strings only. Example: ["What if X were false?", "How would Y behave in Z?", "Which assumptions break under A?"]`,
  },
  {
    id: 'v3-structured',
    label: 'Structured',
    prompt: `You are an analytical question architect. Generate 3-5 structured follow-up questions that:
1. Clarify definitions and boundaries
2. Probe mechanisms or causes
3. Check implications and tradeoffs
4. Compare competing explanations

Return a JSON array of strings only.`,
  },
]

const PROMPT_SELECTION_EPSILON = 0.2
const promptStats = new Map<string, { count: number; avgScore: number }>()

function selectPromptVariant(): PromptVariant {
  if (QUESTION_PROMPT_VARIANTS.length === 0) {
    throw new Error('No question prompt variants configured')
  }

  if (Math.random() < PROMPT_SELECTION_EPSILON) {
    return QUESTION_PROMPT_VARIANTS[Math.floor(Math.random() * QUESTION_PROMPT_VARIANTS.length)]
  }

  let bestVariant = QUESTION_PROMPT_VARIANTS[0]
  let bestScore = -Infinity
  QUESTION_PROMPT_VARIANTS.forEach((variant) => {
    const stats = promptStats.get(variant.id)
    const score = stats ? stats.avgScore : 0
    if (score > bestScore) {
      bestScore = score
      bestVariant = variant
    }
  })
  return bestVariant
}

function updatePromptStats(variantId: string, score: number) {
  const prev = promptStats.get(variantId)
  if (!prev) {
    promptStats.set(variantId, { count: 1, avgScore: score })
    return
  }
  const nextCount = prev.count + 1
  const nextAvg = (prev.avgScore * prev.count + score) / nextCount
  promptStats.set(variantId, { count: nextCount, avgScore: nextAvg })
}

/**
 * Score generated questions for quality.
 * Logged to Weave for self-improvement tracking.
 */
const QUESTION_SCORE_PROMPT = `You are a strict judge of question quality.
Score a set of follow-up questions from 0 to 10 based on:
- Diversity of perspectives
- Depth and curiosity
- Usefulness for exploration

Return JSON only:
{"score": number, "strengths": ["..."], "weaknesses": ["..."]}`

interface QuestionSetScore {
  score: number
  strengths: string[]
  weaknesses: string[]
}

export const scoreQuestionSet = weave.op(
  async function scoreQuestionSet(
    question: string,
    questions: string[],
    model: string = config.defaultModel
  ): Promise<QuestionSetScore> {
    if (questions.length === 0) {
      return { score: 0, strengths: [], weaknesses: ['No questions generated'] }
    }

    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: QUESTION_SCORE_PROMPT },
        { role: 'user', content: JSON.stringify({ question, questions }) },
      ],
      temperature: 0,
      max_tokens: 300,
    })

    const content = response.choices[0]?.message?.content || '{}'
    const parsed = parseRobustJson<Partial<QuestionSetScore>>(content, {})
    const score = typeof parsed.score === 'number' ? parsed.score : Math.min(10, 2 + questions.length)
    return {
      score,
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
      weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [],
    }
  }
)

/**
 * Interface for generated questions response.
 */
export interface GeneratedQuestions {
  questions: string[]
  model: string
  meta: {
    promptVariant: string
    promptLabel: string
    qualityScore: number | null
    evalModel: string
  }
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

    const promptVariant = selectPromptVariant()
    console.log(`[Inference] Using prompt variant: ${promptVariant.id}`)

    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: promptVariant.prompt },
        { role: 'user', content: question },
      ],
      temperature: 0.8,
      max_tokens: 500,
    })

    const content = response.choices[0]?.message?.content || '[]'
    
    // Parse the JSON response
    let questions = parseRobustJson<string[]>(content, [])
    
    if (!Array.isArray(questions)) {
      // Fallback for cases where it might return a single string or object
      if (typeof questions === 'string') {
        questions = [questions]
      } else {
        // Splitting by newlines as a last resort
        questions = content
          .split('\n')
          .map((q) => q.trim())
          .filter((q) => q.length > 0 && !q.startsWith('[') && !q.startsWith(']') && !q.startsWith('{'))
      }
    }

    let qualityScore: number | null = null
    try {
      const scored = await scoreQuestionSet(question, questions, model)
      qualityScore = scored.score
      updatePromptStats(promptVariant.id, scored.score)
      console.log(`[Inference] Weave score: ${scored.score}`)
    } catch (error) {
      if (!isTestMode) {
        console.warn('[Inference] Scoring failed:', error)
      }
    }

    const result: GeneratedQuestions = {
      questions,
      model,
      meta: {
        promptVariant: promptVariant.id,
        promptLabel: promptVariant.label,
        qualityScore,
        evalModel: model,
      },
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

// ============================================
// PROBE CHAT FUNCTIONALITY
// ============================================

/**
 * System prompt for Probe synthesis conversations.
 * Emphasizes weaving together collected insights.
 */
const PROBE_SYSTEM_PROMPT = `You are an intellectual companion helping synthesize collected insights from an exploration journey.

The user has gathered highlights, explanations, questions, and notes during their inquiry through the Fractal app. Your role is to:

1. Help weave these fragments into coherent understanding
2. Identify patterns and connections across the collected items
3. Offer deeper insights that emerge from the combination of ideas
4. Answer their specific questions while drawing on the context they've provided
5. Suggest new directions for exploration based on the synthesis

Be thoughtful and substantive. The user has already done significant exploration - help them take it further.`

/**
 * Stash item type for probe context.
 */
export interface ProbeStashItem {
  id: string
  type: 'highlight' | 'explanation' | 'question' | 'chat-message' | 'note'
  content: string
  metadata: {
    summary?: string
    context?: string
    sourceQuestion?: string
    title?: string
    role?: string
  }
}

/**
 * Build context string from stash items.
 */
function buildProbeContext(stashItems: ProbeStashItem[]): string {
  if (stashItems.length === 0) return ''

  const sections: string[] = ['## Context from your exploration:\n']

  const highlights = stashItems.filter(i => i.type === 'highlight')
  const explanations = stashItems.filter(i => i.type === 'explanation')
  const questions = stashItems.filter(i => i.type === 'question')
  const notes = stashItems.filter(i => i.type === 'note')
  const chatMessages = stashItems.filter(i => i.type === 'chat-message')

  if (highlights.length > 0) {
    sections.push('### Key Concepts')
    highlights.forEach(item => {
      const source = item.metadata.sourceQuestion
        ? ` (from: "${item.metadata.sourceQuestion}")`
        : ''
      sections.push(`- **${item.content}**${source}`)
    })
    sections.push('')
  }

  if (explanations.length > 0) {
    sections.push('### Explanations')
    explanations.forEach(item => {
      const summary = item.metadata.summary || item.content
      sections.push(`- **${item.content}**: ${summary}`)
    })
    sections.push('')
  }

  if (questions.length > 0) {
    sections.push('### Questions Explored')
    questions.forEach(item => {
      sections.push(`- ${item.content}`)
    })
    sections.push('')
  }

  if (notes.length > 0) {
    sections.push('### Notes')
    notes.forEach(item => {
      const title = item.metadata.title ? `**${item.metadata.title}**: ` : ''
      sections.push(`- ${title}${item.content}`)
    })
    sections.push('')
  }

  if (chatMessages.length > 0) {
    sections.push('### Relevant Excerpts')
    chatMessages.forEach(item => {
      const role = item.metadata.role === 'assistant' ? 'AI' : 'You'
      const truncated = item.content.length > 200 
        ? item.content.slice(0, 200) + '...'
        : item.content
      sections.push(`- [${role}]: "${truncated}"`)
    })
    sections.push('')
  }

  return sections.join('\n')
}

/**
 * Send a probe chat message with stash items as context.
 * 
 * @param messages - Conversation history
 * @param stashItems - Selected stash items for context
 * @param model - LLM model to use
 */
export const probeChat = weave.op(
  async function probeChat(
    messages: ChatMessage[],
    stashItems: ProbeStashItem[],
    model: string = config.defaultModel
  ): Promise<ChatResponse> {
    console.log(`[ProbeChat] Processing message with ${stashItems.length} stash items`)
    console.log(`[ProbeChat] Conversation length: ${messages.length} messages`)
    console.log(`[ProbeChat] Using model: ${model}`)

    // Build context from stash items
    const stashContext = buildProbeContext(stashItems)

    // Build the full message array with system context
    const systemContent = stashContext
      ? `${PROBE_SYSTEM_PROMPT}\n\n${stashContext}`
      : PROBE_SYSTEM_PROMPT

    const fullMessages: ChatMessage[] = [
      { role: 'system', content: systemContent },
      ...messages,
    ]

    const response = await client.chat.completions.create({
      model,
      messages: fullMessages,
      temperature: 0.7,
      max_tokens: 1500, // Slightly higher for synthesis
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

    console.log(`[ProbeChat] Response length: ${content.length} chars`)
    console.log(`[ProbeChat] Token usage: ${result.usage.totalTokens}`)

    return result
  }
)

// ============================================
// CONCEPT EXTRACTION FUNCTIONALITY
// ============================================

/**
 * Valid concept categories for classification.
 */
export type ConceptCategory =
  | 'science'
  | 'philosophy'
  | 'psychology'
  | 'technology'
  | 'abstract'

/**
 * An extracted concept with position and metadata.
 */
export interface ExtractedConcept {
  id: string
  text: string
  normalizedName: string
  category: ConceptCategory
  startIndex: number
  endIndex: number
}

/**
 * System prompt for concept extraction.
 */
const CONCEPT_EXTRACTION_PROMPT = `You are an expert at identifying key concepts in questions and text.

Given a question or text, identify the key intellectual concepts that would benefit from explanation or exploration.

For each concept, provide:
1. "text": The exact text span as it appears in the source (case-sensitive)
2. "normalizedName": A canonical/dictionary form of the concept (e.g., "evolutionary" → "evolution")
3. "category": One of: "science", "philosophy", "psychology", "technology", "abstract"
   - science: biology, physics, chemistry, mathematics, natural sciences
   - philosophy: consciousness, epistemology, metaphysics, ethics, logic
   - psychology: behavior, emotion, cognition, mental processes
   - technology: computing, AI, engineering, systems, tools
   - abstract: general concepts, relationships, meta-topics
4. "startIndex": The character position where the concept starts (0-based)
5. "endIndex": The character position where the concept ends (exclusive)

Rules:
- Extract 2-6 concepts maximum
- Only extract meaningful intellectual concepts, not common words
- Concepts should not overlap in the text
- Be precise with start/end indices

Respond with a JSON array of objects. Only output valid JSON, nothing else.

Example for input "Why do we dream during sleep?":
[
  {"text": "dream", "normalizedName": "dreams", "category": "psychology", "startIndex": 10, "endIndex": 15},
  {"text": "sleep", "normalizedName": "sleep", "category": "science", "startIndex": 23, "endIndex": 28}
]`

/**
 * Response structure for concept extraction.
 */
export interface ConceptExtractionResult {
  concepts: ExtractedConcept[]
  sourceText: string
  model: string
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

/**
 * Generate unique concept ID.
 */
function generateConceptId(): string {
  return `c_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

/**
 * Extract key concepts from question text.
 * This function is wrapped with weave.op() for automatic tracing.
 */
export const extractConcepts = weave.op(
  async function extractConcepts(
    questionText: string,
    model: string = config.defaultModel
  ): Promise<ConceptExtractionResult> {
    console.log(`[Concepts] Extracting concepts from: "${questionText.substring(0, 50)}..."`)
    console.log(`[Concepts] Using model: ${model}`)

    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: CONCEPT_EXTRACTION_PROMPT },
        { role: 'user', content: questionText },
      ],
      temperature: 0.3, // Lower temperature for more consistent extraction
      max_tokens: 500,
    })

    const content = response.choices[0]?.message?.content || '[]'
    
    // Parse the JSON response
    const rawConcepts = parseRobustJson<Array<{
      text: string
      normalizedName: string
      category: ConceptCategory
      startIndex: number
      endIndex: number
    }>>(content, [])

    // Validate and add IDs to concepts
    // IMPORTANT: We compute actual positions by finding the occurrence CLOSEST to
    // where the LLM thought the concept was. This handles cases where a word appears
    // multiple times in the text.
    const validCategories = ['science', 'philosophy', 'psychology', 'technology', 'abstract']
    
    /**
     * Find all occurrences of a substring (case-insensitive).
     */
    const findAllOccurrences = (haystack: string, needle: string): number[] => {
      const indices: number[] = []
      const haystackLower = haystack.toLowerCase()
      const needleLower = needle.toLowerCase()
      let pos = 0
      while ((pos = haystackLower.indexOf(needleLower, pos)) !== -1) {
        indices.push(pos)
        pos += 1
      }
      return indices
    }
    
    /**
     * Find the occurrence closest to the target index.
     */
    const findClosestOccurrence = (indices: number[], targetIndex: number): number | null => {
      if (indices.length === 0) return null
      if (indices.length === 1) return indices[0]
      
      return indices.reduce((closest, current) => {
        const currentDist = Math.abs(current - targetIndex)
        const closestDist = Math.abs(closest - targetIndex)
        return currentDist < closestDist ? current : closest
      })
    }
    
    const concepts: ExtractedConcept[] = rawConcepts
      .filter((c) => {
        // Validate required fields
        if (!c.text || typeof c.text !== 'string') return false
        if (!c.normalizedName || typeof c.normalizedName !== 'string') return false
        if (!validCategories.includes(c.category)) return false
        return true
      })
      .map((c) => {
        // Find ALL occurrences of the concept text in the source
        const allOccurrences = findAllOccurrences(questionText, c.text)
        
        if (allOccurrences.length === 0) {
          // Concept text not found in source - skip it
          if (!isTestMode) {
            console.warn(`[Concepts] Text "${c.text}" not found in source, skipping`)
          }
          return null
        }
        
        // Pick the occurrence closest to where the LLM thought it was
        // This handles cases where a word appears multiple times
        const llmSuggestedIndex = typeof c.startIndex === 'number' ? c.startIndex : 0
        const bestIndex = findClosestOccurrence(allOccurrences, llmSuggestedIndex)
        
        if (bestIndex === null) {
          return null
        }
        
        // Use the actual text from the source (preserving original case)
        const actualText = questionText.slice(bestIndex, bestIndex + c.text.length)
        
        return {
          id: generateConceptId(),
          text: actualText,
          normalizedName: c.normalizedName,
          category: c.category,
          startIndex: bestIndex,
          endIndex: bestIndex + c.text.length,
        }
      })
      .filter((c): c is ExtractedConcept => c !== null)
      // Sort by start position and remove overlaps
      .sort((a, b) => a.startIndex - b.startIndex)
      .reduce<ExtractedConcept[]>((acc, concept) => {
        // Skip if overlaps with previous concept
        if (acc.length > 0 && concept.startIndex < acc[acc.length - 1].endIndex) {
          return acc
        }
        return [...acc, concept]
      }, [])

    const result: ConceptExtractionResult = {
      concepts,
      sourceText: questionText,
      model,
      usage: {
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
      },
    }

    console.log(`[Concepts] Extracted ${concepts.length} valid concepts`)
    console.log(`[Concepts] Token usage: ${result.usage.totalTokens}`)

    return result
  }
)

// ============================================
// CONCEPT EXPLANATION FUNCTIONALITY
// ============================================

/**
 * System prompt for concept explanation.
 */
const CONCEPT_EXPLANATION_PROMPT = `You are an expert at explaining intellectual concepts clearly and concisely.

Given a concept and the question context it appears in, provide:
1. A brief, accessible explanation of the concept (2-3 sentences)
2. How this concept relates to or illuminates the specific question
3. Related concepts that could lead to further exploration

Respond with a JSON object:
{
  "summary": "Brief standalone explanation of the concept",
  "context": "How this concept relates to the user's specific question",
  "relatedConcepts": ["concept1", "concept2", "concept3"]
}

Be concise but insightful. Avoid jargon unless explaining it.
Only output valid JSON, nothing else.`

/**
 * Explanation for a concept.
 */
export interface ConceptExplanation {
  conceptId: string
  normalizedName: string
  summary: string
  context: string
  relatedConcepts: string[]
}

/**
 * Full response from concept explanation.
 */
export interface ConceptExplanationResult {
  explanation: ConceptExplanation
  model: string
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

/**
 * Generate an explanation for a concept in context.
 * This function is wrapped with weave.op() for automatic tracing.
 */
export const explainConcept = weave.op(
  async function explainConcept(
    conceptId: string,
    conceptName: string,
    questionContext: string,
    model: string = config.defaultModel
  ): Promise<ConceptExplanationResult> {
    console.log(`[Concepts] Explaining concept: "${conceptName}"`)
    console.log(`[Concepts] In context of: "${questionContext.substring(0, 50)}..."`)
    console.log(`[Concepts] Using model: ${model}`)

    const userMessage = `Concept to explain: "${conceptName}"
    
Question context: "${questionContext}"`

    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: CONCEPT_EXPLANATION_PROMPT },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.5,
      max_tokens: 400,
    })

    const content = response.choices[0]?.message?.content || '{}'
    
    // Parse the JSON response
    const parsed = parseRobustJson<{
      summary?: string
      context?: string
      relatedConcepts?: string[]
    }>(content, {
      summary: `${conceptName} is a concept related to the question being explored.`,
      context: 'This concept is relevant to understanding the question at hand.',
      relatedConcepts: [],
    })

    const explanation: ConceptExplanation = {
      conceptId,
      normalizedName: conceptName,
      summary: parsed.summary || `${conceptName} is a concept being explored.`,
      context: parsed.context || 'This concept relates to the question.',
      relatedConcepts: Array.isArray(parsed.relatedConcepts) 
        ? parsed.relatedConcepts.slice(0, 5) // Limit to 5 related concepts
        : [],
    }

    const result: ConceptExplanationResult = {
      explanation,
      model,
      usage: {
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
      },
    }

    console.log(`[Concepts] Generated explanation with ${explanation.relatedConcepts.length} related concepts`)
    console.log(`[Concepts] Token usage: ${result.usage.totalTokens}`)

    return result
  }
)
