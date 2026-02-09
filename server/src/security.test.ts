import { describe, expect, it, vi } from 'vitest'
import type { Request, Response } from 'express'
import { createApiAuthMiddleware, createApiRateLimitMiddleware } from './security.js'

function createMockResponse() {
  const response = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: null as unknown,
    setHeader(key: string, value: string) {
      this.headers[key] = value
      return this
    },
    status(code: number) {
      this.statusCode = code
      return this
    },
    json(payload: unknown) {
      this.body = payload
      return this
    },
  }

  return response as unknown as Response & {
    statusCode: number
    headers: Record<string, string>
    body: unknown
  }
}

function createMockRequest({
  authorization,
  ip = '127.0.0.1',
}: {
  authorization?: string
  ip?: string
}) {
  const req = {
    ip,
    socket: { remoteAddress: ip },
    header: (name: string) => {
      if (name.toLowerCase() === 'authorization') return authorization
      return undefined
    },
  }
  return req as unknown as Request
}

describe('security middleware', () => {
  it('accepts valid bearer tokens when auth is enabled', () => {
    const middleware = createApiAuthMiddleware({ enabled: true, apiKey: 'secret-token' })
    const req = createMockRequest({ authorization: 'Bearer secret-token' })
    const res = createMockResponse()
    const next = vi.fn()

    middleware(req, res, next)

    expect(next).toHaveBeenCalledTimes(1)
    expect(res.statusCode).toBe(200)
  })

  it('rejects missing bearer tokens when auth is enabled', () => {
    const middleware = createApiAuthMiddleware({ enabled: true, apiKey: 'secret-token' })
    const req = createMockRequest({})
    const res = createMockResponse()
    const next = vi.fn()

    middleware(req, res, next)

    expect(next).not.toHaveBeenCalled()
    expect(res.statusCode).toBe(401)
    expect(res.body).toEqual({
      error: 'Unauthorized',
      message: 'Missing bearer token',
    })
  })

  it('enforces request limit per client within the time window', () => {
    const middleware = createApiRateLimitMiddleware({
      windowMs: 60_000,
      maxRequests: 2,
    })
    const req = createMockRequest({ ip: '10.0.0.1' })
    const next = vi.fn()

    const res1 = createMockResponse()
    middleware(req, res1, next)
    expect(res1.statusCode).toBe(200)

    const res2 = createMockResponse()
    middleware(req, res2, next)
    expect(res2.statusCode).toBe(200)

    const res3 = createMockResponse()
    middleware(req, res3, next)
    expect(res3.statusCode).toBe(429)
    expect(res3.body).toEqual({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please retry later.',
    })
  })
})
