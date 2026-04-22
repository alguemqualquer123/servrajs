import { createApp } from '../../dist/index.js';
import { rateLimit } from '../../dist/security/rate-limit.js';
import { request } from './requestHelper.js';
import { test, expect, createMockRes } from '../testkit.js';

await test('rateLimit blocks after max requests', async () => {
  const app = createApp({ security: { rateLimit: { max: 1, keyGenerator: (req) => 'test' } } });
  app.get('/rl', (req, res) => res.json({ ok: true }));
  await withServer(app, async (port) => {
    const first = await request(port, { path: '/rl' });
    const second = await request(port, { path: '/rl' });
    if (first.status !== 200) throw new Error('first request failed');
    if (second.status !== 429) throw new Error('rate limit not enforced');
  });
});
