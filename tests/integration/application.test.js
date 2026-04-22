import { test, expect, withServer, request } from '../testkit.js';
import { createApp, bodyParser } from '../../dist/index.js';

test('createApp() creates an application with expected methods', () => {
  const app = createApp();
  expect(app).toBeDefined();
  expect(typeof app.get).toBe('function');
  expect(typeof app.post).toBe('function');
  expect(typeof app.use).toBe('function');
  expect(typeof app.listen).toBe('function');
});

test('basic route returns JSON', async () => {
  const app = createApp();
  app.get('/hello', (_req, res) => res.json({ ok: true }));

  await withServer(app, async (port) => {
    const response = await request(port, { path: '/hello' });
    expect(response.status).toBe(200);
    expect(response.body).toContain('"ok":true');
  });
});

test('route groups apply prefix', async () => {
  const app = createApp();
  app.group('/api', () => {
    app.get('/ping', (_req, res) => res.json({ ok: true }));
  });

  await withServer(app, async (port) => {
    const response = await request(port, { path: '/api/ping' });
    expect(response.status).toBe(200);
    expect(response.body).toContain('"ok":true');
  });
});

test('bodyParser + echo works', async () => {
  const app = createApp();
  app.use(bodyParser({ limit: '1mb' }));
  app.post('/echo', (req, res) => res.json({ body: req.body }));

  await withServer(app, async (port) => {
    const response = await request(port, {
      path: '/echo',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ a: 1 }),
    });

    expect(response.status).toBe(200);
    expect(response.body).toContain('"a":1');
  });
});

