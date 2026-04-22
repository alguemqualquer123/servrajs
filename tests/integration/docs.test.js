import { test, expect, withServer, request } from '../testkit.js';
import { createApp, bodyParser } from '../../dist/index.js';

test('/docs serves UI', async () => {
  const app = createApp();
  app.docs({ title: 'Test Docs', apiKeys: ['docs-secret'] });

  await withServer(app, async (port) => {
    const response = await request(port, { path: '/docs' });
    expect(response.status).toBe(200);
    expect(response.body).toContain('Test Docs');
    expect(response.body).toContain('Docs access key');
  });
});

test('/docs/spec.json requires docs key', async () => {
  const app = createApp();
  app.get('/hello', (_req, res) => res.json({ hello: true }));
  app.docs({ apiKeys: ['docs-secret'] });

  await withServer(app, async (port) => {
    const denied = await request(port, { path: '/docs/spec.json' });
    const allowed = await request(port, {
      path: '/docs/spec.json',
      headers: { 'X-Docs-Key': 'docs-secret' },
    });

    expect(denied.status).toBe(401);
    expect(allowed.status).toBe(200);
    expect(allowed.body).toContain('/hello');
  });
});

test('/docs/try executes same-origin requests with docs key', async () => {
  const app = createApp();
  app.use(bodyParser({ limit: '1mb' }));
  app.post('/echo', (req, res) => res.json({ body: req.body }));
  app.documentRoute({
    method: 'POST',
    path: '/echo',
    summary: 'Echo body',
    request: { body: { message: 'hello' } },
    responses: { '200': { body: { body: { message: 'hello' } } } },
  });
  app.docs({ apiKeys: ['docs-secret'] });

  await withServer(app, async (port) => {
    const response = await request(port, {
      path: '/docs/try',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Docs-Key': 'docs-secret',
      },
      body: JSON.stringify({
        method: 'POST',
        path: '/echo',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: 'hello' }),
      }),
    });

    expect(response.status).toBe(200);
    expect(response.body).toContain('"statusCode":200');
    expect(response.body).toContain('hello');
  });
});

