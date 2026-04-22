import {
  bodyParser,
  createApp,
  fileSizeLimit,
  queryParser,
  sanitize,
} from '__PACKAGE_NAME__';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errors.js';
import { registerRoutes } from './routes/index.js';

export function createApi() {
  const docsKeys = env.docsKeys.length > 0
    ? env.docsKeys
    : env.nodeEnv === 'production'
      ? []
      : ['dev-docs-key'];

  const app = createApp({
    debug: env.debug,
    dev: env.nodeEnv !== 'production',
    security: {
      enabled: true,
      bodyLimit: env.bodyLimit,
      timeout: env.requestTimeoutMs,
      cors: {
        origin: env.corsOrigins.length > 0 ? env.corsOrigins : undefined,
        credentials: env.corsOrigins.length > 0,
      },
      rateLimit: {
        enabled: true,
        max: env.rateLimitMax,
        windowMs: env.rateLimitWindowMs,
      },
      csrf: {
        enabled: false,
        secret: env.csrfSecret,
      },
    },
  });

  app.use([
    fileSizeLimit({ maxFileSize: 5 * 1024 * 1024 }),
    bodyParser({ limit: env.bodyLimit }),
    queryParser(),
    sanitize(),
  ]);

  registerRoutes(app);
  app.get('/openapi.json', (req, res) => res.json(app.getOpenApiSpec()));
  app.get('/scalar', (req, res) => {
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Scalar API Reference</title>
</head>
<body>
  <script type="module">
    import {{ default as ApiReference }} from 'https://cdn.jsdelivr.net/npm/@scalar/api-reference';
    const el = document.createElement('div');
    document.body.appendChild(el);
    ApiReference({
      spec: '/openapi.json',
      layout: 'classic',
    }, el);
  </script>
</body>
</html>`;
    res.header('Content-Type', 'text/html').send(html);
  });

  return app;
}

function registerDocs(app: ReturnType<typeof createApp>): void {
  app.documentRoute({
    method: 'GET',
    path: '/health',
    summary: 'Health check',
    description: 'Returns service health and uptime information.',
    tags: ['System'],
    responses: {
      '200': {
        description: 'Service is healthy',
        body: {
          ok: true,
          status: 'healthy',
          uptimeSeconds: 10,
          startedAt: '2026-04-21T00:00:00.000Z',
          requestId: '1',
        },
      },
    },
  });

  app.documentRoute({
    method: 'GET',
    path: '/api/v1',
    summary: 'API index',
    description: 'Lists API metadata and common routes.',
    tags: ['System'],
    responses: {
      '200': {
        description: 'API metadata',
        body: {
          ok: true,
          data: {
            name: '__PROJECT_NAME__',
            version: '1.0.0',
            routes: ['/health', '/api/v1/users'],
          },
        },
      },
    },
  });

  app.documentRoute({
    method: 'GET',
    path: '/api/v1/users',
    summary: 'List users',
    description: 'Returns all users currently stored in memory.',
    tags: ['Users'],
    responses: {
      '200': {
        description: 'User list',
        body: {
          ok: true,
          data: [
            {
              id: 'usr_1',
              name: 'Ada Lovelace',
              email: 'ada@example.com',
              createdAt: '2026-04-21T00:00:00.000Z',
            },
          ],
        },
      },
    },
  });

  app.documentRoute({
    method: 'GET',
    path: '/api/v1/users/:id',
    summary: 'Get user by id',
    description: 'Returns one user by id.',
    tags: ['Users'],
    request: {
      params: {
        id: 'usr_1',
      },
    },
    responses: {
      '200': {
        description: 'User found',
        body: {
          ok: true,
          data: {
            id: 'usr_1',
            name: 'Ada Lovelace',
            email: 'ada@example.com',
            createdAt: '2026-04-21T00:00:00.000Z',
          },
        },
      },
      '404': {
        description: 'User not found',
        body: {
          ok: false,
          error: 'User not found',
          statusCode: 404,
        },
      },
    },
  });

  app.documentRoute({
    method: 'POST',
    path: '/api/v1/users',
    summary: 'Create user',
    description: 'Creates a user in the in-memory store.',
    tags: ['Users'],
    request: {
      contentType: 'application/json',
      headers: {
        'content-type': 'application/json',
      },
      body: {
        name: 'Alan Turing',
        email: 'alan@example.com',
      },
    },
    responses: {
      '201': {
        description: 'User created',
        body: {
          ok: true,
          data: {
            id: 'generated-uuid',
            name: 'Alan Turing',
            email: 'alan@example.com',
            createdAt: '2026-04-21T00:00:00.000Z',
          },
        },
      },
      '400': {
        description: 'Validation error',
        body: {
          ok: false,
          error: 'Email must be valid',
          statusCode: 400,
        },
      },
    },
  });
}
