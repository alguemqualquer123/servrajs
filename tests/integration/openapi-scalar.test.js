import { test, expect, withServer, request } from '../testkit.js';
import { createApp, openApiScalar } from '../../dist/index.js';

test('openApiScalar() exposes /openapi.json and includes registered routes', async () => {
  const app = createApp();
  app.get('/hello', (_req, res) => res.json({ ok: true }));
  await app.plugin(openApiScalar({ specPath: '/openapi.json', referencePath: '/reference' }));

  await withServer(app, async (port) => {
    const response = await request(port, { path: '/openapi.json' });
    expect(response.status).toBe(200);
    expect(response.body).toContain('"openapi"');
    expect(response.body).toContain('/hello');
  });
});

test('openApiScalar() serves Scalar UI HTML at /reference', async () => {
  const app = createApp();
  await app.plugin(openApiScalar({ specPath: '/openapi.json', referencePath: '/reference' }));

  await withServer(app, async (port) => {
    const response = await request(port, { path: '/reference' });
    expect(response.status).toBe(200);
    expect(response.body).toContain('<api-reference');
    expect(response.body).toContain('data-url="/openapi.json"');
  });
});

