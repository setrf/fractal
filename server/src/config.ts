/**
 * Server Configuration
 * ====================
 * 
 * Loads and validates environment variables for the Fractal server.
 */

import dotenv from 'dotenv'

// Load environment variables from .env file
dotenv.config()

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback
  const normalized = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false
  return fallback
}

function parseCsv(value: string | undefined): string[] {
  if (!value) return []
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
}

const nodeEnv = process.env.NODE_ENV || 'development'

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3001', 10),
  host: process.env.HOST || '127.0.0.1',
  nodeEnv,
  
  // W&B / Weave
  wandbApiKey: process.env.WANDB_API_KEY || '',
  wandbProject: process.env.WANDB_PROJECT || 'fractal',
  
  // W&B Inference API
  inferenceBaseUrl: 'https://api.inference.wandb.ai/v1',
  
  // Default model for question generation
  defaultModel: 'meta-llama/Llama-3.1-8B-Instruct',

  // Eval/policy memory persistence
  policyMemoryPath: process.env.POLICY_MEMORY_PATH || './data/policy-memory.json',

  // Session-level token guardrails
  maxTokensPerSession: Number.parseInt(process.env.MAX_TOKENS_PER_SESSION || '40000', 10),
  tokenWarningThreshold: Number.parseFloat(process.env.TOKEN_WARNING_THRESHOLD || '0.8'),

  // API boundary controls
  requireApiKey: parseBoolean(process.env.REQUIRE_API_KEY, nodeEnv === 'production'),
  serverApiKey: process.env.SERVER_API_KEY || '',
  rateLimitWindowMs: Number.parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  rateLimitMaxRequests: Number.parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '120', 10),

  // CORS controls
  corsAllowedOrigins: parseCsv(process.env.CORS_ALLOWED_ORIGINS),
} as const

/**
 * Validates that required configuration is present.
 */
export function validateConfig(): void {
  const errors: string[] = []
  
  if (!config.wandbApiKey) {
    errors.push('WANDB_API_KEY is required')
  }

  if (!config.host.trim()) {
    errors.push('HOST cannot be empty')
  }

  if (!Number.isFinite(config.port) || config.port <= 0 || config.port > 65535) {
    errors.push('PORT must be a valid TCP port (1-65535)')
  }

  if (!Number.isFinite(config.maxTokensPerSession) || config.maxTokensPerSession <= 0) {
    errors.push('MAX_TOKENS_PER_SESSION must be a positive integer')
  }

  if (
    !Number.isFinite(config.tokenWarningThreshold)
    || config.tokenWarningThreshold < 0
    || config.tokenWarningThreshold > 1
  ) {
    errors.push('TOKEN_WARNING_THRESHOLD must be between 0 and 1')
  }

  if (!Number.isFinite(config.rateLimitWindowMs) || config.rateLimitWindowMs < 1000) {
    errors.push('RATE_LIMIT_WINDOW_MS must be at least 1000 milliseconds')
  }

  if (!Number.isFinite(config.rateLimitMaxRequests) || config.rateLimitMaxRequests < 1) {
    errors.push('RATE_LIMIT_MAX_REQUESTS must be at least 1')
  }

  if (config.requireApiKey && !config.serverApiKey) {
    errors.push('SERVER_API_KEY is required when REQUIRE_API_KEY is enabled')
  }
  
  if (errors.length > 0) {
    console.error('Configuration errors:')
    errors.forEach((err) => console.error(`  - ${err}`))
    process.exit(1)
  }
}
