# OpenAPI

Servra exposes an OpenAPI-flavored JSON document through its docs system. It’s
designed to be useful both for humans (UI) and for tooling (generators, clients).

## Endpoints

When docs are enabled, Servra registers:

- `GET /docs` (UI)
- `GET /docs/spec.json` (spec + routes)
- `GET /docs/openapi.json` (same output as `spec.json`)
- `POST /docs/try` (same-origin request runner, optional)

The base path can be changed with `app.docs({ path: '/something' })`.

## What the spec contains

The spec includes:

- `openapi: "3.1.0"`
- `info` metadata (`title`, `version`, `description`)
- `routes`: an array of documented route objects (Servra’s richer model)
- `paths`: a simplified OpenAPI `paths` object derived from the routes

## Documenting routes

Servra automatically knows about registered routes (method and path). For richer
metadata, use `app.documentRoute(...)`:

```ts
app.documentRoute({
  method: 'POST',
  path: '/api/v1/users',
  summary: 'Create user',
  tags: ['Users'],
  request: {
    contentType: 'application/json',
    body: { name: 'Ada Lovelace', email: 'ada@example.com' },
  },
  responses: {
    '201': { description: 'Created', body: { ok: true } },
    '400': { description: 'Validation error' },
  },
});
```

## Current limitations

The generated `paths` object focuses on the essentials (summary, description,
tags, and responses). It does not currently expand request bodies, parameters,
or schemas into full OpenAPI structures.

If you need full OpenAPI modeling, treat Servra’s output as a starting point and
post-process it in your build step, or maintain a hand-written OpenAPI document.

