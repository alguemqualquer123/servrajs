# Features

This page is meant to be practical: what you can rely on today, and how the
pieces fit together.

## Core

- **Router**: a radix-tree router with `:params` support and per-route middleware.
- **Middleware runner**: supports sync and async middleware, early exit, and a
  simple error-handler pipeline.
- **Request / response objects**: small wrappers around Node's `IncomingMessage`
  and `ServerResponse`.

## Security defaults

Servra enables a security middleware by default. You can fine-tune it via
`createApp({ security: { ... } })` or disable it entirely.

Built-in security primitives include:

- Response headers (Helmet-like)
- Rate limiting (in-memory)
- CORS handling
- Optional CSRF protection
- Input sanitizing (query/params by default; request bodies via the `sanitize()` middleware)

## Documentation tooling

Servra can expose:

- A docs UI (default path: `/docs`)
- A JSON spec at `/docs/spec.json` (also available as `/docs/openapi.json`)
- A same-origin request runner (`POST /docs/try`) with strict header filtering
  and size limits

You can document routes incrementally using `app.documentRoute(...)`.

## Developer experience

- TypeScript-first typings
- A small CLI (`servra create`, `servra dev`, `servra start`)
- Template project in `templates/api-base`
