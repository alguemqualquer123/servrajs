# Philosophy

Servra is intentionally small. The goal is to provide the basics you need to
ship APIs quickly without turning the framework into a second application.

## Explicit, not magical

- You opt into request body parsing by adding `bodyParser()`.
- You decide where validation happens by attaching `validator(...)` to routes.
- You can keep middleware global, route-local, or both.

## Secure defaults, configurable surface

Security is enabled by default, but it’s not “all or nothing”. The core settings
live under `createApp({ security: { ... } })`, and you can tweak individual
subsystems (CORS, rate limiting, CSRF) without rewriting the pipeline.

## Documentation is part of the runtime

Docs work best when they run with the service, not as a separate build step.
Servra’s docs system focuses on:

- A clean UI for teams
- A JSON spec you can export
- A safe try-it runner for same-origin requests

If you need a different UI (Swagger UI, Scalar, Redoc), you can serve those on
top of the generated OpenAPI JSON.

