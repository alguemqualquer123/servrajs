import { createApp } from '../../dist/index.js';
import { cors } from '../../dist/middleware/runner.js';
import { test, expect, createMockRes } from '../testkit.js';

await test('CORS middleware respects allowed origin', async () => {
  const app = createApp({ security: { cors: { origin: 'https://allowed.com' } } });
  app.get('/cors', (req, res) => res.json({ ok: true }));
  await withServer(app, async (port) => {
    const allowed = await request(port, { path: '/cors', headers: { Origin: 'https://allowed.com' } });
    const denied = await request(port, { path: '/cors', headers: { Origin: 'https://denied.com' } });
    if (!allowed.headers['access-control-allow-origin']) throw new Error('allowed missing header');
    if (denied.headers['access-control-allow-origin']) throw new Error('denied should not have header');
  });
});
