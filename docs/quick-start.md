# Quick Start

Servra apps are created with `createApp()`. Routes are registered by method, and
the server is started with `listen()`.

## Minimal server

```ts
import { createApp } from 'servra';

const app = createApp({ debug: true });

app.get('/', (_req, res) => res.json({ message: 'Hello' }));

await app.listen(3000, '127.0.0.1');
```

## JSON body and basic protections

Request bodies are not parsed unless you add `bodyParser()`.

```ts
import { bodyParser, createApp, fileSizeLimit, queryParser } from 'servra';

const app = createApp({
  security: {
    enabled: true,
    rateLimit: { enabled: true, max: 100, windowMs: 60_000 },
  },
});

app.use([
  fileSizeLimit({ maxFileSize: 5 * 1024 * 1024 }),
  bodyParser({ limit: '1mb' }),
  queryParser(),
]);

app.post('/users', (req, res) => {
  const { name, email } = req.body;
  return res.status(201).json({ ok: true, data: { name, email } });
});

await app.listen(3000, '127.0.0.1');
```

## Generate a project

If you want a working layout with docs and example routes:

```bash
npx servra create my-api
```

