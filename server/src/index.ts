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

async function main() {
  console.log('='.repeat(50))
  console.log('  Fractal Server')
  console.log('='.repeat(50))
  
  // Validate configuration
  validateConfig()
  console.log('[Config] Configuration validated')
  
  // Initialize Weave for tracing
  await initializeWeave()
  
  // Create Express app
  const app = express()
  
  // Middleware
  app.use(cors({
    origin: [
      'http://localhost:5173',
      'http://localhost:5174', 
      'http://localhost:5175',
      'http://localhost:5176',
      'http://localhost:5177',
    ],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }))
  app.use(express.json())
  
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
  
  // Start server
  app.listen(config.port, () => {
    console.log('='.repeat(50))
    console.log(`[Server] Running on http://localhost:${config.port}`)
    console.log(`[Server] Environment: ${config.nodeEnv}`)
    console.log(`[Weave] Project: ${config.wandbProject}`)
    console.log(`[Weave] Dashboard: https://wandb.ai/${config.wandbProject}`)
    console.log('='.repeat(50))
  })
}

main().catch((error) => {
  console.error('Failed to start server:', error)
  process.exit(1)
})
