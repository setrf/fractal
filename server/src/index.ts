/**
 * Fractal Server
 * ==============
 * 
 * Express server for the Fractal application.
 * 
 * Features:
 * - W&B Weave integration for tracing and observability
 * - W&B Inference for LLM-powered question generation
 * - RESTful API for the React frontend
 * 
 * The server initializes Weave before starting to ensure
 * all LLM calls are properly traced.
 */

import express from 'express'
import cors from 'cors'
import { config, validateConfig } from './config.js'
import { initializeWeave } from './weave-client.js'
import { router } from './routes.js'
import { createApiAuthMiddleware, createApiRateLimitMiddleware } from './security.js'

function isLocalDevOrigin(origin: string): boolean {
  return /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)
}

function isAllowedOrigin(origin: string): boolean {
  if (config.corsAllowedOrigins.includes(origin)) return true
  if (config.nodeEnv !== 'production' && isLocalDevOrigin(origin)) return true
  return false
}

export function createApp() {
  const app = express()
  app.disable('x-powered-by')

  app.use(cors({
    origin: (origin, callback) => {
      if (!origin) {
        if (config.nodeEnv === 'production') {
          callback(new Error('Origin header is required'))
          return
        }
        callback(null, true)
        return
      }

      if (isAllowedOrigin(origin)) {
        callback(null, true)
        return
      }

      callback(new Error('Not allowed by CORS'))
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }))

  app.use(express.json({ limit: '256kb' }))

  app.use(
    '/api',
    createApiRateLimitMiddleware({
      windowMs: config.rateLimitWindowMs,
      maxRequests: config.rateLimitMaxRequests,
    })
  )

  app.use(
    '/api',
    createApiAuthMiddleware({
      enabled: config.requireApiKey,
      apiKey: config.serverApiKey,
    })
  )

  // Request logging middleware
  app.use((req, res, next) => {
    const start = Date.now()
    res.on('finish', () => {
      const duration = Date.now() - start
      console.log(`[${req.method}] ${req.path} - ${res.statusCode} (${duration}ms)`)
    })
    next()
  })

  // Routes
  app.use(router)

  return app
}

async function main() {
  console.log('='.repeat(50))
  console.log('  Fractal Server')
  console.log('='.repeat(50))
  
  // Validate configuration
  validateConfig()
  console.log('[Config] Configuration validated')
  
  // Initialize Weave for tracing
  await initializeWeave()
  const app = createApp()
  
  // Start server
  app.listen(config.port, config.host, () => {
    console.log('='.repeat(50))
    console.log(`[Server] Running on http://${config.host}:${config.port}`)
    console.log(`[Server] Environment: ${config.nodeEnv}`)
    console.log(`[Weave] Project: ${config.wandbProject}`)
    console.log(`[Weave] Dashboard: https://wandb.ai/${config.wandbProject}`)
    console.log(`[Eval] Policy memory: ${config.policyMemoryPath}`)
    console.log(`[Guard] Max tokens/session: ${config.maxTokensPerSession}`)
    console.log(`[Guard] Rate limit: ${config.rateLimitMaxRequests}/${config.rateLimitWindowMs}ms`)
    console.log(`[Guard] API key required: ${config.requireApiKey ? 'yes' : 'no'}`)
    console.log('='.repeat(50))
  })
}

main().catch((error) => {
  console.error('Failed to start server:', error)
  process.exit(1)
})
