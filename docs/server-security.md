# Server Security And Runtime Controls

The server now supports explicit API boundary controls through environment variables:

- `HOST`: bind address for the server listener (default `127.0.0.1`).
- `REQUIRE_API_KEY`: enables bearer token checks on `/api/*`.
- `SERVER_API_KEY`: shared token expected in `Authorization: Bearer <token>`.
- `RATE_LIMIT_WINDOW_MS`: rolling window size in milliseconds.
- `RATE_LIMIT_MAX_REQUESTS`: max requests allowed per client IP in the window.
- `CORS_ALLOWED_ORIGINS`: comma-separated allowlist of browser origins.

Behavior details:

- API auth defaults to enabled in production (`NODE_ENV=production`) and disabled in development unless explicitly set.
- When auth is enabled, requests without a valid bearer token receive `401`.
- Rate limits are enforced on all `/api/*` routes and return `429` with `Retry-After` when exceeded.
- In production, cross-origin requests must include an `Origin` header and match the allowlist.
