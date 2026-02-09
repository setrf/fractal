import { beforeEach, describe, expect, it, vi } from 'vitest'
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
  remoteAddress,
}: {
  authorization?: string
  ip?: string | undefined
  remoteAddress?: string | undefined
}) {
  const req = {
    ip,
    socket: { remoteAddress: remoteAddress ?? ip },
    header: (name: string) => {
      if (name.toLowerCase() === 'authorization') return authorization
      return undefined
    },
  }
  return req as unknown as Request
}

describe('security middleware', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('bypasses auth checks when auth is disabled', () => {
    const middleware = createApiAuthMiddleware({ enabled: false, apiKey: 'secret-token' })
    const req = createMockRequest({})
    const res = createMockResponse()
    const next = vi.fn()

    middleware(req, res, next)

    expect(next).toHaveBeenCalledTimes(1)
    expect(res.statusCode).toBe(200)
  })

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

  it('rejects malformed auth headers when auth is enabled', () => {
    const middleware = createApiAuthMiddleware({ enabled: true, apiKey: 'secret-token' })
    const req = createMockRequest({ authorization: 'Token secret-token' })
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

  it('rejects invalid bearer tokens when auth is enabled', () => {
    const middleware = createApiAuthMiddleware({ enabled: true, apiKey: 'secret-token' })
    const req = createMockRequest({ authorization: 'Bearer wrong-token' })
    const res = createMockResponse()
    const next = vi.fn()

    middleware(req, res, next)

    expect(next).not.toHaveBeenCalled()
    expect(res.statusCode).toBe(401)
    expect(res.body).toEqual({
      error: 'Unauthorized',
      message: 'Invalid API token',
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

  it('tracks rate limits independently per client', () => {
    const middleware = createApiRateLimitMiddleware({
      windowMs: 60_000,
      maxRequests: 1,
    })
    const next = vi.fn()

    const reqA = createMockRequest({ ip: '10.0.0.1' })
    const reqB = createMockRequest({ ip: '10.0.0.2' })

    const resA1 = createMockResponse()
    middleware(reqA, resA1, next)
    expect(resA1.statusCode).toBe(200)

    const resB1 = createMockResponse()
    middleware(reqB, resB1, next)
    expect(resB1.statusCode).toBe(200)

    const resA2 = createMockResponse()
    middleware(reqA, resA2, next)
    expect(resA2.statusCode).toBe(429)
  })

  it('resets the rate-limit window after window duration', () => {
    const nowSpy = vi.spyOn(Date, 'now')
    nowSpy
      .mockReturnValueOnce(1_000)
      .mockReturnValueOnce(1_200)
      .mockReturnValueOnce(2_200)

    const middleware = createApiRateLimitMiddleware({
      windowMs: 1_000,
      maxRequests: 2,
    })
    const req = createMockRequest({ ip: '10.0.0.1' })
    const next = vi.fn()

    const res1 = createMockResponse()
    middleware(req, res1, next)
    expect(res1.statusCode).toBe(200)
    expect(res1.headers['X-RateLimit-Remaining']).toBe('1')

    const res2 = createMockResponse()
    middleware(req, res2, next)
    expect(res2.statusCode).toBe(200)
    expect(res2.headers['X-RateLimit-Remaining']).toBe('0')

    const res3 = createMockResponse()
    middleware(req, res3, next)
    expect(res3.statusCode).toBe(200)
    expect(res3.headers['X-RateLimit-Remaining']).toBe('1')
  })

  it('falls back to socket remote address when request ip is unavailable', () => {
    const middleware = createApiRateLimitMiddleware({
      windowMs: 60_000,
      maxRequests: 1,
    })
    const next = vi.fn()

    const req = createMockRequest({
      ip: undefined,
      remoteAddress: '192.168.0.50',
    })

    const res1 = createMockResponse()
    middleware(req, res1, next)
    expect(res1.statusCode).toBe(200)

    const res2 = createMockResponse()
    middleware(req, res2, next)
    expect(res2.statusCode).toBe(429)
  })
})
