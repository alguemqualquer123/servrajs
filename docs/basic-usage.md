# Basic Usage

This page covers the patterns you'll use most: routing, middleware, errors,
groups, and docs.

## Routing

```ts
import { createApp } from 'servra';

const app = createApp();

app.get('/health', (_req, res) => res.json({ ok: true }));
app.get('/users/:id', (req, res) => res.json({ id: req.params.id }));
```

### Returning values

Handlers can return a value. If the response wasn't sent yet, Servra will send:

- JSON for objects
- Plain text for other types

```ts
app.get('/version', () => ({ name: 'servra', version: '1.0.0' }));
```

## Route grouping

Grouping is just a prefix that applies while the callback runs.

```ts
app.group('/api/v1', () => {
  app.get('/users', (_req, res) => res.json([]));
  app.post('/users', (_req, res) => res.status(201).json({ ok: true }));
});
```

## Middleware

Global middleware runs for every request. Route middleware only runs for that
route.

```ts
import { bodyParser, createApp } from 'servra';

const app = createApp();

app.use(bodyParser());

function auth(req, res, next) {
  if (!req.header('authorization')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

app.get('/private', auth, (_req, res) => res.json({ ok: true }));
```

## Errors

For application-level error handling, register an error handler:

```ts
app.setErrorHandler(async (err, req, res) => {
  req; // you can still inspect request context here
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});
```

## Documentation hooks

Servra can expose docs endpoints via `app.docs(...)` and lets you attach richer
route metadata with `app.documentRoute(...)`.

See [Documentation](./documentation.md) for the full workflow.

