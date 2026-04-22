# Documentation

Servra includes a runtime documentation system. It exposes a UI and a JSON spec
that can be secured with an API key header.

This page explains how to enable it safely and how to keep docs useful over
time.

## Enabling docs

Docs can be enabled at startup:

```ts
import { createApp } from 'servra';

const app = createApp();

app.docs({
  title: 'My Service API',
  version: '1.0.0',
  description: 'Internal API documentation',
  apiKeys: ['dev-docs-key'],
});
```

By default, the UI is served at `/docs` and the spec lives at `/docs/spec.json`.

## Securing access

Docs access is controlled by a single header (default: `x-docs-key`). If you do
not configure keys and you don’t allow public access, the spec endpoint returns
401.

You can configure the header name and storage key:

```ts
app.docs({
  security: {
    apiKeys: ['my-long-key'],
    headerName: 'x-docs-key',
    storageKey: 'loa_docs_key',
    allowPublicAccess: false,
  },
});
```

## Keeping route docs in sync

Routes are registered automatically, but good docs require metadata. Attach it
near the route, or in a dedicated “docs registration” module:

- `summary` for the short name
- `description` for important behavior details
- `tags` to keep navigation sane
- `request` / `responses` examples for the try-it runner

### Hiding routes

If you don't want a route to show up in docs:

```ts
app.documentRoute({ method: 'GET', path: '/internal', hidden: true });
```

## The try-it request runner

When enabled, the docs UI can send a request through `POST /docs/try`.

Safety properties:

- Same-origin only (relative paths)
- Header allowlist (dangerous headers are blocked)
- Request and response size limits (`maxRequestBytes`, `maxResponseBytes`)

Even with those safeguards, you should treat try-it as an internal tool. Keep it
behind authentication or limit it to non-production environments.

