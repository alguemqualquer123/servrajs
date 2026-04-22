import { createApp } from '../../dist/index.js';
import { addDefaultChecks, setupHealthChecks, getHealthStatus } from '../../dist/resilience/health.js';
// Minimal request helper for this test
function request(port, options = {}) {
  const body = options.body;
  const headers = { ...(options.headers ?? {}) };

  if (body !== undefined && headers['Content-Length'] === undefined) {
    headers['Content-Length'] = Buffer.byteLength(body);
  }

  return new Promise((resolve, reject) => {
    const req = require('node:http').request({
      hostname: '127.0.0.1',
      port,
      path: options.path ?? '/',
      method: options.method ?? 'GET',
      headers,
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks).toString(),
        });
      });
    });
    req.on('error', reject);
    if (body !== undefined) req.write(body);
    req.end();
  });
}


await test('health endpoint returns healthy status', async () => {
  const app = createApp();
  addDefaultChecks();
  setupHealthChecks(app);
  await withServer(app, async (port) => {
    const res = await request(port, { path: '/health' });
    if (res.status !== 200) throw new Error('status not 200');
    const body = JSON.parse(res.body);
    if (body.status !== 'healthy') throw new Error('not healthy');
  });
});
