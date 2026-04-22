# tmp-api-template

API base criada com `@srvinix/loa`.

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

## Exemplo

```bash
curl http://127.0.0.1:3000/health
curl -H "x-docs-key: dev-docs-key" http://127.0.0.1:3000/docs/spec.json
curl http://127.0.0.1:3000/api/v1/users
curl -X POST http://127.0.0.1:3000/api/v1/users \
  -H "content-type: application/json" \
  -d "{\"name\":\"Ada Lovelace\",\"email\":\"ada@example.com\"}"
```

Configure variáveis copiando `.env.example` para `.env` no seu ambiente de deploy.

Em desenvolvimento, `/docs` usa a chave `dev-docs-key` se `DOCS_KEYS` não estiver configurado.
Em produção, configure `DOCS_KEYS` para liberar a UI e o executor de requisições.
