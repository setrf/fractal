import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const ORIGINAL_ENV = { ...process.env }

function resetEnv() {
  process.env = { ...ORIGINAL_ENV }
}

function applyValidBaseEnv() {
  process.env.WANDB_API_KEY = 'test-wandb-key'
  process.env.PORT = '3001'
  process.env.HOST = '127.0.0.1'
  process.env.NODE_ENV = 'development'
  process.env.MAX_TOKENS_PER_SESSION = '40000'
  process.env.TOKEN_WARNING_THRESHOLD = '0.8'
  process.env.RATE_LIMIT_WINDOW_MS = '60000'
  process.env.RATE_LIMIT_MAX_REQUESTS = '120'
}

async function loadConfigModule() {
  vi.resetModules()
  return import('./config.js')
}

describe('config', () => {
  beforeEach(() => {
    resetEnv()
    applyValidBaseEnv()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    resetEnv()
  })

  it('uses production default for REQUIRE_API_KEY when not explicitly set', async () => {
    process.env.NODE_ENV = 'production'
    process.env.SERVER_API_KEY = 'secret-token'

    const { config } = await loadConfigModule()

    expect(config.requireApiKey).toBe(true)
  })

  it('uses development default for REQUIRE_API_KEY when not explicitly set', async () => {
    process.env.NODE_ENV = 'development'

    const { config } = await loadConfigModule()

    expect(config.requireApiKey).toBe(false)
  })

  it('parses boolean and csv values from env vars', async () => {
    process.env.REQUIRE_API_KEY = ' yes '
    process.env.CORS_ALLOWED_ORIGINS = 'https://app.example.com, http://localhost:5173, ,'
    process.env.SERVER_API_KEY = 'secret-token'

    const { config } = await loadConfigModule()

    expect(config.requireApiKey).toBe(true)
    expect(config.corsAllowedOrigins).toEqual([
      'https://app.example.com',
      'http://localhost:5173',
    ])
  })

  it('falls back to default boolean when REQUIRE_API_KEY is invalid', async () => {
    process.env.NODE_ENV = 'production'
    process.env.REQUIRE_API_KEY = 'not-a-boolean'
    process.env.SERVER_API_KEY = 'secret-token'

    const { config } = await loadConfigModule()

    expect(config.requireApiKey).toBe(true)
  })

  it('passes validation with a fully valid config', async () => {
    process.env.SERVER_API_KEY = 'secret-token'
    process.env.REQUIRE_API_KEY = 'true'

    const { validateConfig } = await loadConfigModule()
    const exitSpy = vi.spyOn(process, 'exit')
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    validateConfig()

    expect(consoleSpy).not.toHaveBeenCalledWith('Configuration errors:')
    expect(exitSpy).not.toHaveBeenCalled()
  })

  it('fails validation when API key is required but missing', async () => {
    process.env.NODE_ENV = 'production'
    process.env.REQUIRE_API_KEY = 'true'
    delete process.env.SERVER_API_KEY

    const { validateConfig } = await loadConfigModule()
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit:${code}`)
    }) as never)

    expect(() => validateConfig()).toThrow('process.exit:1')
    expect(consoleSpy).toHaveBeenCalledWith('Configuration errors:')
    expect(consoleSpy).toHaveBeenCalledWith('  - SERVER_API_KEY is required when REQUIRE_API_KEY is enabled')
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  it('fails validation for invalid numeric ranges', async () => {
    process.env.PORT = '70000'
    process.env.TOKEN_WARNING_THRESHOLD = '1.5'
    process.env.RATE_LIMIT_WINDOW_MS = '500'
    process.env.RATE_LIMIT_MAX_REQUESTS = '0'
    process.env.MAX_TOKENS_PER_SESSION = '-1'

    const { validateConfig } = await loadConfigModule()
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit:${code}`)
    }) as never)

    expect(() => validateConfig()).toThrow('process.exit:1')
    expect(consoleSpy).toHaveBeenCalledWith('Configuration errors:')
    expect(consoleSpy).toHaveBeenCalledWith('  - PORT must be a valid TCP port (1-65535)')
    expect(consoleSpy).toHaveBeenCalledWith('  - MAX_TOKENS_PER_SESSION must be a positive integer')
    expect(consoleSpy).toHaveBeenCalledWith('  - TOKEN_WARNING_THRESHOLD must be between 0 and 1')
    expect(consoleSpy).toHaveBeenCalledWith('  - RATE_LIMIT_WINDOW_MS must be at least 1000 milliseconds')
    expect(consoleSpy).toHaveBeenCalledWith('  - RATE_LIMIT_MAX_REQUESTS must be at least 1')
    expect(exitSpy).toHaveBeenCalledWith(1)
  })
})
