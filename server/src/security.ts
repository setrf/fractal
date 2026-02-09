import crypto from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'

interface ApiAuthOptions {
  enabled: boolean
  apiKey: string
}

interface ApiRateLimitOptions {
  windowMs: number
  maxRequests: number
}

interface RateLimitBucket {
  count: number
  windowStartedAt: number
}

function timingSafeEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  if (leftBuffer.length !== rightBuffer.length) return false
  return crypto.timingSafeEqual(leftBuffer, rightBuffer)
}

export function createApiAuthMiddleware(options: ApiAuthOptions) {
  return function apiAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
    if (!options.enabled) {
      next()
      return
    }

    const authHeader = req.header('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing bearer token',
      })
      return
    }

    const token = authHeader.slice(7).trim()
    if (!token || !timingSafeEquals(token, options.apiKey)) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid API token',
      })
      return
    }

    next()
  }
}

export function createApiRateLimitMiddleware(options: ApiRateLimitOptions) {
  const buckets = new Map<string, RateLimitBucket>()

  return function apiRateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
    const now = Date.now()
    const clientId = req.ip || req.socket.remoteAddress || 'unknown'
    const existing = buckets.get(clientId)

    if (!existing || now - existing.windowStartedAt >= options.windowMs) {
      buckets.set(clientId, { count: 1, windowStartedAt: now })
      res.setHeader('X-RateLimit-Limit', options.maxRequests.toString())
      res.setHeader('X-RateLimit-Remaining', Math.max(options.maxRequests - 1, 0).toString())
      next()
      return
    }

    existing.count += 1
    const remaining = Math.max(options.maxRequests - existing.count, 0)
    res.setHeader('X-RateLimit-Limit', options.maxRequests.toString())
    res.setHeader('X-RateLimit-Remaining', remaining.toString())

    if (existing.count > options.maxRequests) {
      const retryAfterSec = Math.ceil((options.windowMs - (now - existing.windowStartedAt)) / 1000)
      res.setHeader('Retry-After', Math.max(retryAfterSec, 1).toString())
      res.status(429).json({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please retry later.',
      })
      return
    }

    next()
  }
}
