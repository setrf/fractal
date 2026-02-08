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
import {
  assertTokenBudget,
  classifySeedType,
  configureEvalState,
  ensureEvalStateLoaded,
  getCostGuardSnapshot,
  getEvalStatsSnapshot,
  getModelPerformanceSnapshot,
  rankPromptVariants,
  recordEvalRun,
  recordTokenUsage,
  selectPromptVariant,
  type EvalStatsSnapshot,
  type ModelSeedSnapshot,
  type TokenUsage,
} from './eval-state.js'

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

configureEvalState({
  policyPath: config.policyMemoryPath,
  maxTokensPerSession: config.maxTokensPerSession,
  tokenWarningThreshold: config.tokenWarningThreshold,
})

function getPromptVariantById(variantId: string): PromptVariant | null {
  return QUESTION_PROMPT_VARIANTS.find((variant) => variant.id === variantId) ?? null
}

function pickPromptVariant(forcedVariantId?: string): PromptVariant {
  if (forcedVariantId) {
    const forced = getPromptVariantById(forcedVariantId)
    if (!forced) {
      throw new Error(`Unknown prompt variant: ${forcedVariantId}`)
    }
    return forced
  }
  return selectPromptVariant(QUESTION_PROMPT_VARIANTS, PROMPT_SELECTION_EPSILON)
}

function normalizeUsage(usage: Partial<TokenUsage> | undefined): TokenUsage {
  const promptTokens = usage?.promptTokens ?? 0
  const completionTokens = usage?.completionTokens ?? 0
  const totalTokens = usage?.totalTokens ?? promptTokens + completionTokens
  return { promptTokens, completionTokens, totalTokens }
}

function mergeUsage(...parts: Array<Partial<TokenUsage> | undefined>): TokenUsage {
  return parts.reduce<TokenUsage>(
    (acc, usage) => {
      const normalized = normalizeUsage(usage)
      acc.promptTokens += normalized.promptTokens
      acc.completionTokens += normalized.completionTokens
      acc.totalTokens += normalized.totalTokens
      return acc
    },
    { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
  )
}

function normalizeConfidence(raw: number | null | undefined, fallbackScore: number): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    if (raw < 0) return 0
    if (raw > 1) return 1
    return raw
  }
  const scoreBased = fallbackScore / 10
  if (scoreBased < 0.05) return 0.05
  if (scoreBased > 0.95) return 0.95
  return scoreBased
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
- Reliability of the set for deeper investigation

Return JSON only:
{"score": number, "confidence": number, "uncertainty": number, "strengths": ["..."], "weaknesses": ["..."]}`

interface QuestionSetScore {
  score: number
  confidence: number
  uncertainty: number
  strengths: string[]
  weaknesses: string[]
  usage: TokenUsage
}

export const scoreQuestionSet = weave.op(
  async function scoreQuestionSet(
    question: string,
    questions: string[],
    model: string = config.defaultModel
  ): Promise<QuestionSetScore> {
    await ensureEvalStateLoaded()
    if (questions.length === 0) {
      return {
        score: 0,
        confidence: 0.1,
        uncertainty: 0.9,
        strengths: [],
        weaknesses: ['No questions generated'],
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      }
    }

    assertTokenBudget('scoreQuestionSet')
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: QUESTION_SCORE_PROMPT },
        { role: 'user', content: JSON.stringify({ question, questions }) },
      ],
      temperature: 0,
      max_tokens: 300,
    })

    const usage = {
      promptTokens: response.usage?.prompt_tokens || 0,
      completionTokens: response.usage?.completion_tokens || 0,
      totalTokens: response.usage?.total_tokens || 0,
    }
    recordTokenUsage('score', usage)

    const content = response.choices[0]?.message?.content || '{}'
    const parsed = parseRobustJson<Partial<QuestionSetScore>>(content, {})
    const score = typeof parsed.score === 'number' ? parsed.score : Math.min(10, 2 + questions.length)
    const confidence = normalizeConfidence(parsed.confidence, score)
    const uncertainty = normalizeConfidence(parsed.uncertainty, 10 - score)
    return {
      score,
      confidence,
      uncertainty,
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
      weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [],
      usage,
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
    confidence: number | null
    uncertainty: number | null
    strengths: string[]
    weaknesses: string[]
    seedType: ReturnType<typeof classifySeedType>
    costGuard: ReturnType<typeof getCostGuardSnapshot>
  }
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

export interface GenerateRelatedQuestionOptions {
  forcedPromptVariantId?: string
  updatePolicy?: boolean
}

export interface CompareGenerationResponse {
  question: string
  left: GeneratedQuestions
  right: GeneratedQuestions
  winner: 'left' | 'right' | 'tie'
  reason: string
}

/**
 * Generate related questions for a given input question.
 * This function is wrapped with weave.op() for automatic tracing.
 */
export const generateRelatedQuestions = weave.op(
  async function generateRelatedQuestions(
    question: string,
    model: string = config.defaultModel,
    options: GenerateRelatedQuestionOptions = {}
  ): Promise<GeneratedQuestions> {
    await ensureEvalStateLoaded()
    console.log(`[Inference] Generating questions for: "${question}"`)
    console.log(`[Inference] Using model: ${model}`)

    const promptVariant = pickPromptVariant(options.forcedPromptVariantId)
    console.log(`[Inference] Using prompt variant: ${promptVariant.id}`)

    assertTokenBudget('generateRelatedQuestions')
    const generationStartedAt = Date.now()
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: promptVariant.prompt },
        { role: 'user', content: question },
      ],
      temperature: 0.8,
      max_tokens: 500,
    })
    const generationUsage: TokenUsage = {
      promptTokens: response.usage?.prompt_tokens || 0,
      completionTokens: response.usage?.completion_tokens || 0,
      totalTokens: response.usage?.total_tokens || 0,
    }
    recordTokenUsage('generate', generationUsage)

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
    let confidence: number | null = null
    let uncertainty: number | null = null
    let strengths: string[] = []
    let weaknesses: string[] = []
    let scoreUsage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
    try {
      const scored = await scoreQuestionSet(question, questions, model)
      qualityScore = scored.score
      confidence = scored.confidence
      uncertainty = scored.uncertainty
      strengths = scored.strengths
      weaknesses = scored.weaknesses
      scoreUsage = scored.usage

      recordEvalRun({
        question,
        variantId: promptVariant.id,
        variantLabel: promptVariant.label,
        model,
        seedType: classifySeedType(question),
        score: scored.score,
        confidence: scored.confidence,
        uncertainty: scored.uncertainty,
        latencyMs: Date.now() - generationStartedAt,
        usage: mergeUsage(generationUsage, scored.usage),
        strengths: scored.strengths,
        weaknesses: scored.weaknesses,
        updatePolicy: options.updatePolicy ?? true,
      })

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
        confidence,
        uncertainty,
        strengths,
        weaknesses,
        seedType: classifySeedType(question),
        costGuard: getCostGuardSnapshot(),
      },
      usage: mergeUsage(generationUsage, scoreUsage),
    }

    console.log(`[Inference] Generated ${questions.length} questions`)
    console.log(`[Inference] Token usage: ${result.usage.totalTokens}`)

    return result
  }
)

export const compareQuestionGenerations = weave.op(
  async function compareQuestionGenerations(
    question: string,
    leftModel: string = config.defaultModel,
    rightModel: string = config.defaultModel,
    leftPromptVariantId?: string,
    rightPromptVariantId?: string
  ): Promise<CompareGenerationResponse> {
    await ensureEvalStateLoaded()

    const ranked = rankPromptVariants(QUESTION_PROMPT_VARIANTS)
    const fallbackLeft = ranked[0]
    const fallbackRight = ranked.find((variant) => variant.id !== fallbackLeft.id) ?? ranked[0]

    const resolvedLeftPrompt = leftPromptVariantId ?? fallbackLeft.id
    const resolvedRightPrompt = rightPromptVariantId ?? fallbackRight.id

    const [left, right] = await Promise.all([
      generateRelatedQuestions(question, leftModel, {
        forcedPromptVariantId: resolvedLeftPrompt,
        updatePolicy: true,
      }),
      generateRelatedQuestions(question, rightModel, {
        forcedPromptVariantId: resolvedRightPrompt,
        updatePolicy: true,
      }),
    ])

    const leftScore = left.meta.qualityScore ?? 0
    const rightScore = right.meta.qualityScore ?? 0

    if (Math.abs(leftScore - rightScore) < 0.1) {
      return {
        question,
        left,
        right,
        winner: 'tie',
        reason: 'Scores are effectively tied on current evaluation criteria.',
      }
    }

    const winner = leftScore > rightScore ? 'left' : 'right'
    return {
      question,
      left,
      right,
      winner,
      reason: `${winner === 'left' ? 'Left' : 'Right'} scored higher (${Math.max(leftScore, rightScore).toFixed(2)} vs ${Math.min(leftScore, rightScore).toFixed(2)}).`,
    }
  }
)

export async function getEvalStats(): Promise<EvalStatsSnapshot> {
  await ensureEvalStateLoaded()
  return getEvalStatsSnapshot(QUESTION_PROMPT_VARIANTS)
}

export async function getModelPerformanceMemory(): Promise<ModelSeedSnapshot[]> {
  await ensureEvalStateLoaded()
  return getModelPerformanceSnapshot()
}

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
    await ensureEvalStateLoaded()
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

    assertTokenBudget('chat')
    const response = await client.chat.completions.create({
      model,
      messages: fullMessages,
      temperature: 0.7,
      max_tokens: 1000,
    })

    const content = response.choices[0]?.message?.content || ''
    const usage = {
      promptTokens: response.usage?.prompt_tokens || 0,
      completionTokens: response.usage?.completion_tokens || 0,
      totalTokens: response.usage?.total_tokens || 0,
    }
    recordTokenUsage('chat', usage)

    const result: ChatResponse = {
      message: content,
      model,
      usage,
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
    await ensureEvalStateLoaded()
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

    assertTokenBudget('probeChat')
    const response = await client.chat.completions.create({
      model,
      messages: fullMessages,
      temperature: 0.7,
      max_tokens: 1500, // Slightly higher for synthesis
    })

    const content = response.choices[0]?.message?.content || ''
    const usage = {
      promptTokens: response.usage?.prompt_tokens || 0,
      completionTokens: response.usage?.completion_tokens || 0,
      totalTokens: response.usage?.total_tokens || 0,
    }
    recordTokenUsage('probe-chat', usage)

    const result: ChatResponse = {
      message: content,
      model,
      usage,
    }

    console.log(`[ProbeChat] Response length: ${content.length} chars`)
    console.log(`[ProbeChat] Token usage: ${result.usage.totalTokens}`)

    return result
  }
)

// ============================================
// PM BRIEF + EXPERIMENT SUGGESTIONS
// ============================================

const PROBE_BRIEF_PROMPT = `You are a senior AI product manager.

Given exploration context and direction, produce a concise PM brief in JSON only.
Required schema:
{
  "problemStatement": "string",
  "hypotheses": ["string", "string"],
  "primaryExperiment": "string",
  "successMetrics": ["string", "string"],
  "risks": ["string", "string"],
  "recommendation": "string",
  "nextExperiments": ["string", "string", "string"]
}

Keep each item concrete and testable. No markdown. JSON only.`

const PROBE_EXPERIMENT_SUGGESTIONS_PROMPT = `You are an AI PM experimentation coach.

Given conversation + research context, propose 3-5 next experiments.
Return JSON only:
{
  "suggestions": [
    {
      "title": "short experiment name",
      "hypothesis": "what this tests",
      "metric": "primary metric"
    }
  ]
}`

export interface ProbeBrief {
  problemStatement: string
  hypotheses: string[]
  primaryExperiment: string
  successMetrics: string[]
  risks: string[]
  recommendation: string
  nextExperiments: string[]
}

export interface ProbeBriefResult {
  brief: ProbeBrief
  markdown: string
  model: string
  usage: TokenUsage
}

export interface ProbeExperimentSuggestion {
  title: string
  hypothesis: string
  metric: string
}

export interface ProbeExperimentSuggestionsResult {
  suggestions: ProbeExperimentSuggestion[]
  model: string
  usage: TokenUsage
}

function buildProbeBriefMarkdown(brief: ProbeBrief): string {
  const toBullets = (items: string[]): string =>
    items.length > 0 ? items.map((item) => `- ${item}`).join('\n') : '- N/A'

  return [
    '# PM Brief',
    '',
    '## Problem Statement',
    brief.problemStatement || 'N/A',
    '',
    '## Hypotheses',
    toBullets(brief.hypotheses),
    '',
    '## Primary Experiment',
    brief.primaryExperiment || 'N/A',
    '',
    '## Success Metrics',
    toBullets(brief.successMetrics),
    '',
    '## Risks',
    toBullets(brief.risks),
    '',
    '## Recommendation',
    brief.recommendation || 'N/A',
    '',
    '## Next Experiments',
    toBullets(brief.nextExperiments),
    '',
  ].join('\n')
}

export const generateProbeBrief = weave.op(
  async function generateProbeBrief(
    stashItems: ProbeStashItem[],
    direction: string,
    model: string = config.defaultModel
  ): Promise<ProbeBriefResult> {
    await ensureEvalStateLoaded()
    const stashContext = buildProbeContext(stashItems)
    const userPayload = JSON.stringify({
      direction,
      context: stashContext,
    })

    assertTokenBudget('generateProbeBrief')
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: PROBE_BRIEF_PROMPT },
        { role: 'user', content: userPayload },
      ],
      temperature: 0.3,
      max_tokens: 900,
    })

    const usage: TokenUsage = {
      promptTokens: response.usage?.prompt_tokens || 0,
      completionTokens: response.usage?.completion_tokens || 0,
      totalTokens: response.usage?.total_tokens || 0,
    }
    recordTokenUsage('probe-brief', usage)

    const content = response.choices[0]?.message?.content || '{}'
    const parsed = parseRobustJson<Partial<ProbeBrief>>(content, {})

    const brief: ProbeBrief = {
      problemStatement: typeof parsed.problemStatement === 'string' ? parsed.problemStatement : 'Clarify the core user problem and context.',
      hypotheses: Array.isArray(parsed.hypotheses) ? parsed.hypotheses.slice(0, 5) : [],
      primaryExperiment: typeof parsed.primaryExperiment === 'string' ? parsed.primaryExperiment : 'Run a lightweight experiment to validate top hypothesis.',
      successMetrics: Array.isArray(parsed.successMetrics) ? parsed.successMetrics.slice(0, 5) : [],
      risks: Array.isArray(parsed.risks) ? parsed.risks.slice(0, 5) : [],
      recommendation: typeof parsed.recommendation === 'string' ? parsed.recommendation : 'Prioritize the highest-signal, lowest-cost next step.',
      nextExperiments: Array.isArray(parsed.nextExperiments) ? parsed.nextExperiments.slice(0, 5) : [],
    }

    return {
      brief,
      markdown: buildProbeBriefMarkdown(brief),
      model,
      usage,
    }
  }
)

export const suggestProbeExperiments = weave.op(
  async function suggestProbeExperiments(
    messages: ChatMessage[],
    stashItems: ProbeStashItem[],
    model: string = config.defaultModel
  ): Promise<ProbeExperimentSuggestionsResult> {
    await ensureEvalStateLoaded()
    const stashContext = buildProbeContext(stashItems)
    const messageContext = messages
      .slice(-6)
      .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
      .join('\n')

    assertTokenBudget('suggestProbeExperiments')
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: PROBE_EXPERIMENT_SUGGESTIONS_PROMPT },
        {
          role: 'user',
          content: JSON.stringify({
            stashContext,
            recentConversation: messageContext,
          }),
        },
      ],
      temperature: 0.4,
      max_tokens: 700,
    })

    const usage: TokenUsage = {
      promptTokens: response.usage?.prompt_tokens || 0,
      completionTokens: response.usage?.completion_tokens || 0,
      totalTokens: response.usage?.total_tokens || 0,
    }
    recordTokenUsage('probe-experiments', usage)

    const content = response.choices[0]?.message?.content || '{}'
    const parsed = parseRobustJson<{ suggestions?: Array<Partial<ProbeExperimentSuggestion>> }>(content, {})
    const suggestions = Array.isArray(parsed.suggestions)
      ? parsed.suggestions
        .map((item) => ({
          title: typeof item.title === 'string' ? item.title : '',
          hypothesis: typeof item.hypothesis === 'string' ? item.hypothesis : '',
          metric: typeof item.metric === 'string' ? item.metric : '',
        }))
        .filter((item) => item.title && item.hypothesis && item.metric)
        .slice(0, 5)
      : []

    return {
      suggestions,
      model,
      usage,
    }
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
    await ensureEvalStateLoaded()
    console.log(`[Concepts] Extracting concepts from: "${questionText.substring(0, 50)}..."`)
    console.log(`[Concepts] Using model: ${model}`)

    assertTokenBudget('extractConcepts')
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
    recordTokenUsage('concept-extract', result.usage)

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
    await ensureEvalStateLoaded()
    console.log(`[Concepts] Explaining concept: "${conceptName}"`)
    console.log(`[Concepts] In context of: "${questionContext.substring(0, 50)}..."`)
    console.log(`[Concepts] Using model: ${model}`)

    const userMessage = `Concept to explain: "${conceptName}"
    
Question context: "${questionContext}"`

    assertTokenBudget('explainConcept')
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
    recordTokenUsage('concept-explain', result.usage)

    console.log(`[Concepts] Generated explanation with ${explanation.relatedConcepts.length} related concepts`)
    console.log(`[Concepts] Token usage: ${result.usage.totalTokens}`)

    return result
  }
)
