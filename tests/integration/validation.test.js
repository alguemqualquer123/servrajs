import { test, expect, withServer, request } from '../testkit.js';
import { createApp, bodyParser, validator } from '../../dist/index.js';

test('bodyParser parses x-www-form-urlencoded payloads', async () => {
  const app = createApp();
  app.use(bodyParser({ limit: '1mb' }));
  app.post('/form', (req, res) => res.json({ body: req.body }));

  await withServer(app, async (port) => {
    const response = await request(port, {
      path: '/form',
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'name=Ada&role=dev',
    });

    expect(response.status).toBe(200);
    expect(response.body).toContain('"name":"Ada"');
    expect(response.body).toContain('"role":"dev"');
  });
});

test('bodyParser rejects invalid JSON early', async () => {
  const app = createApp();
  app.use(bodyParser({ limit: '1mb' }));
  app.post('/json', (_req, res) => res.json({ ok: true }));

  await withServer(app, async (port) => {
    const response = await request(port, {
      path: '/json',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{not-json',
    });

    expect(response.status).toBe(400);
  });
});

test('validator returns 400 with structured errors', async () => {
  const app = createApp();
  app.use(bodyParser({ limit: '1mb' }));
  app.post('/users', validator({
    name: { type: 'string', required: true, min: 2 },
    email: { type: 'string', required: true },
  }), (req, res) => res.json({ ok: true, validated: req.validated }));

  await withServer(app, async (port) => {
    const response = await request(port, {
      path: '/users',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'A' }),
    });

    expect(response.status).toBe(400);
    expect(response.body).toContain('Validation Failed');
    expect(response.body).toContain('email is required');
  });
});

test('validator attaches validated payload on success', async () => {
  const app = createApp();
  app.use(bodyParser({ limit: '1mb' }));
  app.post('/users', validator({
    name: { type: 'string', required: true, min: 2 },
    age: { type: 'number' },
  }), (req, res) => res.json({ ok: true, validated: req.validated }));

  await withServer(app, async (port) => {
    const response = await request(port, {
      path: '/users',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Ada', age: 36 }),
    });

    expect(response.status).toBe(200);
    expect(response.body).toContain('"name":"Ada"');
    expect(response.body).toContain('"age":36');
  });
});

