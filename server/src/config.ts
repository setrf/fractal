/**
 * Server Configuration
 * ====================
 * 
 * Loads and validates environment variables for the Fractal server.
 */

import dotenv from 'dotenv'

// Load environment variables from .env file
dotenv.config()

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // W&B / Weave
  wandbApiKey: process.env.WANDB_API_KEY || '',
  wandbProject: process.env.WANDB_PROJECT || 'fractal',
  
  // W&B Inference API
  inferenceBaseUrl: 'https://api.inference.wandb.ai/v1',
  
  // Default model for question generation
  defaultModel: 'meta-llama/Llama-3.1-8B-Instruct',
} as const

/**
 * Validates that required configuration is present.
 */
export function validateConfig(): void {
  const errors: string[] = []
  
  if (!config.wandbApiKey) {
    errors.push('WANDB_API_KEY is required')
  }
  
  if (errors.length > 0) {
    console.error('Configuration errors:')
    errors.forEach((err) => console.error(`  - ${err}`))
    process.exit(1)
  }
}
