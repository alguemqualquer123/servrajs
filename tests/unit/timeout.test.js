import { createApp } from '../../dist/index.js';
import { timeout } from '../../dist/middleware/runner.js';
import { request } from './requestHelper.js';

await test('timeout middleware aborts long handler', async () => {
  const app = createApp();
  app.get('/slow', timeout(50), async (req, res) => {
    await new Promise(r => setTimeout(r, 200));
    res.json({ done: true });
  });
  await withServer(app, async (port) => {
    const res = await request(port, { path: '/slow' });
    if (res.status !== 503) throw new Error('expected timeout status');
  });
});
