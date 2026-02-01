/**
 * Weave Client Setup
 * ==================
 * 
 * Initializes the W&B Weave client for tracing and observability.
 * 
 * Weave provides:
 * - Automatic tracing of LLM calls
 * - Input/output logging
 * - Latency monitoring
 * - Cost tracking
 */

import * as weave from 'weave'
import { config } from './config.js'

let weaveInitialized = false

/**
 * Initialize Weave tracing.
 * This must be called before any traced operations.
 */
export async function initializeWeave(): Promise<void> {
  if (weaveInitialized) {
    console.log('[Weave] Already initialized')
    return
  }

  try {
    console.log(`[Weave] Initializing project: ${config.wandbProject}`)
    await weave.init(config.wandbProject)
    weaveInitialized = true
    console.log('[Weave] Successfully initialized')
  } catch (error) {
    console.warn('[Weave] Failed to initialize (running without tracing):', error)
    // throw error
  }
}

/**
 * Check if Weave has been initialized.
 */
export function isWeaveInitialized(): boolean {
  return weaveInitialized
}

// Re-export weave for use in other modules
export { weave }
