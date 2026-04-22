# Use Cases

Servra is a good fit when you want an API that starts fast, has a small surface
area, and stays predictable under load.

Below are a few common patterns.

## 1) Internal service with secure runtime docs

Teams often want docs that are always up to date and available in staging.

- Enable docs at `/docs`
- Require a docs key header
- Keep try-it enabled only in non-production

```ts
import { createApp } from 'servra';

const app = createApp();
app.docs({
  title: 'Billing API',
  version: '1.4.0',
  apiKeys: [process.env.DOCS_KEY ?? 'dev-docs-key'],
  tryIt: process.env.NODE_ENV !== 'production',
});
```

## 2) Public API with strict limits

For public endpoints, you typically want:

- Rate limiting turned on
- Narrow CORS rules (or none at all)
- Conservative body limits

```ts
import { bodyParser, createApp, fileSizeLimit } from 'servra';

const app = createApp({
  security: {
    enabled: true,
    bodyLimit: '256kb',
    cors: { origin: ['https://app.example.com'], credentials: true },
    rateLimit: { enabled: true, max: 60, windowMs: 60_000 },
  },
});

app.use([fileSizeLimit({ maxFileSize: 256 * 1024 }), bodyParser({ limit: '256kb' })]);
```

## 3) Small monolith with route groups

Route groups work well when you want a clear, readable module layout.

```ts
import { createApp } from 'servra';

const app = createApp();

app.group('/api/v1', () => {
  app.get('/users', listUsers);
  app.post('/users', createUser);
});
```

## 4) Simple HTTP service close to Node

When you want to stay close to Node’s HTTP primitives and keep dependencies
minimal, Servra is comfortable: it’s easy to reason about what happens on each
request.
