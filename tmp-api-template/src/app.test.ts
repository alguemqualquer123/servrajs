import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { request } from 'node:http';
import { createApi } from './app.js';

const app = createApi();
let port = 0;

before(async () => {
  const server = await app.listen(0, '127.0.0.1');
  const address = server.address();
  assert.equal(typeof address, 'object');
  port = address?.port ?? 0;
});

after(async () => {
  await app.close();
});

test('health endpoint returns ok', async () => {
  const response = await get('/health');
  assert.equal(response.statusCode, 200);
  assert.match(response.body, /healthy/);
});

test('users endpoint returns seeded users', async () => {
  const response = await get('/api/v1/users');
  assert.equal(response.statusCode, 200);
  assert.match(response.body, /Ada Lovelace/);
});

test('docs spec requires a key', async () => {
  const response = await get('/docs/spec.json');
  assert.equal(response.statusCode, 401);
});

test('docs spec returns registered routes with key', async () => {
  const response = await get('/docs/spec.json', {
    'x-docs-key': 'dev-docs-key',
  });
  assert.equal(response.statusCode, 200);
  assert.match(response.body, /Create user/);
});

test('docs try executes a registered request with key', async () => {
  const response = await send({
    path: '/docs/try',
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-docs-key': 'dev-docs-key',
    },
    body: JSON.stringify({
      method: 'GET',
      path: '/health',
      headers: {},
    }),
  });

  assert.equal(response.statusCode, 200);
  assert.match(response.body, /"statusCode":200/);
  assert.match(response.body, /healthy/);
});

function get(path: string, headers: Record<string, string> = {}): Promise<{ statusCode: number; body: string }> {
  return send({ path, headers });
}

function send(options: {
  path: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const headers = { ...(options.headers ?? {}) };
    if (options.body && headers['content-length'] === undefined) {
      headers['content-length'] = Buffer.byteLength(options.body).toString();
    }

    const req = request({
      hostname: '127.0.0.1',
      port,
      path: options.path,
      method: options.method ?? 'GET',
      headers,
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode ?? 0,
          body: Buffer.concat(chunks).toString(),
        });
      });
    });

    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}
