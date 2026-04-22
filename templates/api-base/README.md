# __PROJECT_NAME__

Base API generated with `__PACKAGE_NAME__` (Servra).

## Scripts

```bash
npm install
npm run dev
npm test
npm start
```

## Endpoints

- `GET /health`
- `GET /docs`
- `GET /api/v1`
- `GET /api/v1/users`
- `GET /api/v1/users/:id`
- `POST /api/v1/users`

## Example

```bash
curl http://127.0.0.1:3000/health
curl -H "x-docs-key: dev-docs-key" http://127.0.0.1:3000/docs/spec.json
curl http://127.0.0.1:3000/api/v1/users
curl -X POST http://127.0.0.1:3000/api/v1/users \
  -H "content-type: application/json" \
  -d "{\"name\":\"Ada Lovelace\",\"email\":\"ada@example.com\"}"
```

Configure environment variables by copying `.env.example` to `.env` in your deploy environment.

In development, `/docs` uses the `dev-docs-key` key if `DOCS_KEYS` is not set.
In production, set `DOCS_KEYS` to enable the UI and the request runner.
