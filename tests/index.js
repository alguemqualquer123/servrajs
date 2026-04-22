import { request as httpRequest } from 'node:http';
import { createApp, bodyParser, sanitize, validator as validatorMiddleware, createSchema, MiddlewareRunner } from '../dist/index.js';
import { RadixTree } from '../dist/router/radix-tree.js';
import { isEmail, isPhone, isUrl, isUUID } from '../dist/validation/validator.js';

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (error) {
    console.log(`  ❌ ${name}`);
    console.log(`     Error: ${error.message}`);
    failed++;
  }
}

function expect(value) {
  return {
    toBe(expected) {
      if (value !== expected) {
        throw new Error(`Expected ${expected}, got ${value}`);
      }
    },
    toBeDefined() {
      if (value === undefined || value === null) {
        throw new Error(`Expected value to be defined, got ${value}`);
      }
    },
    toBeTruthy() {
      if (!value) {
        throw new Error(`Expected value to be truthy, got ${value}`);
      }
    },
    toBeUndefined() {
      if (value !== undefined) {
        throw new Error(`Expected value to be undefined, got ${value}`);
      }
    },
    toContain(expected) {
      if (!String(value).includes(expected)) {
        throw new Error(`Expected ${value} to contain ${expected}`);
      }
    },
    notToContain(expected) {
      if (String(value).includes(expected)) {
        throw new Error(`Expected ${value} not to contain ${expected}`);
      }
    }
  };
}

async function withServer(app, fn) {
  const server = await app.listen(0, '127.0.0.1');
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  try {
    return await fn(port);
  } finally {
    await app.close();
  }
}

function request(port, options = {}) {
  const body = options.body;
  const headers = { ...(options.headers ?? {}) };
  if (body !== undefined && headers['Content-Length'] === undefined) {
    headers['Content-Length'] = Buffer.byteLength(body);
  }
  return new Promise((resolve, reject) => {
    const req = httpRequest({
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

function firstCookie(response, name) {
  const cookies = response.headers['set-cookie'] ?? [];
  const list = Array.isArray(cookies) ? cookies : [cookies];
  const match = list.find((cookie) => cookie.startsWith(`${name}=`));
  return match?.split(';')[0];
}

console.log('\n🧪 Servra Tests\n');
console.log('0. Unit Tests:');

await test('RadixTree matches static routes (trailing slash ignored)', () => {
  const tree = new RadixTree();
  const handler = () => 'ok';
  tree.add('GET', '/users', handler, []);
  const match1 = tree.lookup('GET', '/users');
  const match2 = tree.lookup('GET', '/users/');
  expect(match1).toBeDefined();
  expect(match2).toBeDefined();
  expect(match1.handler).toBe(handler);
  expect(match2.handler).toBe(handler);
});

await test('RadixTree matches param routes and extracts params', () => {
  const tree = new RadixTree();
  const handler = () => 'ok';
  tree.add('GET', '/users/:id', handler, []);
  const match = tree.lookup('GET', '/users/123');
  expect(match).toBeDefined();
  expect(match.handler).toBe(handler);
  expect(JSON.stringify(match.params)).toBe(JSON.stringify({ id: '123' }));
});

await test('RadixTree matches wildcard routes and captures the rest', () => {
  const tree = new RadixTree();
  const handler = () => 'ok';
  tree.add('GET', '/assets/*', handler, []);
  const match = tree.lookup('GET', '/assets/a/b/c');
  expect(match).toBeDefined();
  expect(match.handler).toBe(handler);
  expect(JSON.stringify(match.params)).toBe(JSON.stringify({ '*': 'a/b/c' }));
});

await test('RadixTree prefers static routes over params', () => {
  const tree = new RadixTree();
  const staticHandler = () => 'static';
  const paramHandler = () => 'param';
  tree.add('GET', '/users/me', staticHandler, []);
  tree.add('GET', '/users/:id', paramHandler, []);
  const match = tree.lookup('GET', '/users/me');
  expect(match).toBeDefined();
  expect(match.handler).toBe(staticHandler);
});

await test('RadixTree isolates routes by method', () => {
  const tree = new RadixTree();
  const handler = () => 'ok';
  tree.add('GET', '/users', handler, []);
  expect(tree.lookup('GET', '/users')).toBeDefined();
  expect(tree.lookup('POST', '/users')).toBe(null);
});

await test('RadixTree getAllRoutes lists inserted routes', () => {
  const tree = new RadixTree();
  tree.add('GET', '/users/:id', () => {}, []);
  tree.add('POST', '/users', () => {}, []);
  const routes = tree.getAllRoutes().map((r) => `${r.method} ${r.path}`).sort();
  expect(JSON.stringify(routes)).toContain('GET /users/:id');
  expect(JSON.stringify(routes)).toContain('POST /users');
});

await test('Schema builder composes a schema definition', () => {
  const schema = createSchema();
  schema.addField('name', { type: 'string', required: true, min: 2 });
  schema.addField('age', { type: 'number', min: 0 });
  const built = schema.build();
  expect(built.name.type).toBe('string');
  expect(built.name.required).toBe(true);
  expect(built.age.type).toBe('number');
});

await test('Validation helpers accept expected formats', () => {
  expect(isEmail('ada@example.com')).toBe(true);
  expect(isEmail('nope')).toBe(false);
  expect(isUrl('https://example.com')).toBe(true);
  expect(isUrl('not a url')).toBe(false);
  expect(isUUID('00000000-0000-0000-0000-000000000000')).toBe(true);
  expect(isUUID('not-uuid')).toBe(false);
  expect(isPhone('+1 (555) 123-4567')).toBe(true);
  expect(isPhone('abc')).toBe(false);
});

await test('validator middleware rejects missing required fields (unit)', async () => {
  const middleware = validatorMiddleware({
    name: { type: 'string', required: true, min: 2 },
  });
  const req = { body: {} };
  const res = createMockRes();
  let nextCalled = false;
  middleware(req, res, () => { nextCalled = true; });
  expect(nextCalled).toBe(false);
  expect(res.statusCode).toBe(400);
  expect(res.payload?.error).toBe('Validation Failed');
});

await test('validator middleware attaches req.validated on success (unit)', async () => {
  const middleware = validatorMiddleware({
    name: { type: 'string', required: true, min: 2 },
    age: { type: 'number' },
  });
  const req = { body: { name: 'Ada', age: 36 } };
  const res = createMockRes();
  let nextCalled = false;
  middleware(req, res, () => { nextCalled = true; });
  expect(nextCalled).toBe(true);
  expect((req).validated.name).toBe('Ada');
  expect((req).validated.age).toBe(36);
});

await test('MiddlewareRunner executes global and route middleware in order (unit)', async () => {
  const runner = new MiddlewareRunner();
  const calls = [];
  runner.use(async (_req, _res, next) => { calls.push('g1'); await next(); calls.push('g1:after'); });
  const route = [async (_req, _res, next) => { calls.push('r1'); await next(); calls.push('r1:after'); }];
  const req = {};
  const res = createMockRes();
  await runner.runWithMiddlewares(req, res, route, async () => { calls.push('final'); });
  expect(JSON.stringify(calls)).toBe(JSON.stringify(['g1', 'r1', 'final', 'r1:after', 'g1:after']));
});

await test('MiddlewareRunner stops when middleware does not call next (unit)', async () => {
  const runner = new MiddlewareRunner();
  let finalCalled = false;
  runner.use((_req, res, _next) => { res.status(200).json({ ok: true }); });
  const req = {};
  const res = createMockRes();
  await runner.runWithMiddlewares(req, res, [], async () => { finalCalled = true; });
  expect(finalCalled).toBe(false);
  expect(res.sent).toBe(true);
});

await test('MiddlewareRunner forwards thrown errors to error handlers (unit)', async () => {
  const runner = new MiddlewareRunner();
  const req = {};
  const res = createMockRes();
  runner.use(() => { throw new Error('boom'); });
  runner.useErrorHandler((err, _req, response, _next) => { response.status(500).json({ ok: false, message: err.message }); });
  await runner.runWithMiddlewares(req, res, [], async () => {});
  expect(res.statusCode).toBe(500);
  expect(res.payload?.message).toBe('boom');
});

console.log('\n1. Application Tests:');
await test('createApp() creates application', () => { const app = createApp(); expect(app).toBeDefined(); });
await test('createApp() has router', () => { const app = createApp(); expect(app.router).toBeDefined(); });
await test('createApp() has logger', () => { const app = createApp(); expect(app.logger).toBeDefined(); });
await test('createApp() has get method', () => { const app = createApp(); expect(typeof app.get).toBe('function'); });
await test('createApp() has post method', () => { const app = createApp(); expect(typeof app.post).toBe('function'); });
await test('createApp() has use method', () => { const app = createApp(); expect(typeof app.use).toBe('function'); });
await test('createApp() has listen method', () => { const app = createApp(); expect(typeof app.listen).toBe('function'); });
await test('createApp() accepts security options', () => { const app = createApp({ security: { enabled: true, helmet: { contentSecurityPolicy: true } } }); expect(app).toBeDefined(); });
await test('createApp() routes work', () => { const app = createApp(); app.get('/hello', (req, res) => { res.json({ message: 'Hello!' }); }); expect(app).toBeDefined(); });
await test('createApp() supports route groups', () => { const app = createApp(); app.group('/api', () => { app.get('/users', (req, res) => res.json({ users: [] })); }); expect(app).toBeDefined(); });
await test('createApp() supports middleware', () => { const app = createApp(); app.use((req, res, next) => { next(); }); expect(app).toBeDefined(); });
await test('createApp() can disable security', () => { const app = createApp({ security: { enabled: false } }); expect(app).toBeDefined(); });

console.log('\n2. Security HTTP Tests:');
await test('default security adds hardened headers and request id', async () => {
  const app = createApp();
  app.get('/secure', (req, res) => res.json({ ok: true }));
  await withServer(app, async (port) => {
    const response = await request(port, { path: '/secure' });
    expect(response.status).toBe(200);
    expect(response.headers['x-request-id']).toBeDefined();
    expect(response.headers['content-security-policy']).toBeDefined();
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});

await test('default CORS denies browser preflight origins', async () => {
  const app = createApp();
  app.options('/secure', (req, res) => res.status(204).send());
  await withServer(app, async (port) => {
    const response = await request(port, { path: '/secure', method: 'OPTIONS', headers: { Origin: 'https://evil.example', 'Access-Control-Request-Method': 'GET' } });
    expect(response.status).toBe(403);
  });
});

await test('configured CORS allows a trusted origin only', async () => {
  const app = createApp({ security: { cors: { origin: 'https://app.example.com' } } });
  app.get('/secure', (req, res) => res.json({ ok: true }));
  await withServer(app, async (port) => {
    const allowed = await request(port, { path: '/secure', headers: { Origin: 'https://app.example.com' } });
    const denied = await request(port, { path: '/secure', headers: { Origin: 'https://evil.example' } });
    expect(allowed.headers['access-control-allow-origin']).toBe('https://app.example.com');
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });
});

await test('rate limit blocks excess requests quickly', async () => {
  const app = createApp({ security: { rateLimit: { max: 1, keyGenerator: (req) => req.header('x-rate-key') || req.ip } } });
  app.get('/limited', (req, res) => res.json({ ok: true }));
  await withServer(app, async (port) => {
    const headers = { 'X-Rate-Key': `test-${Date.now()}` };
    const first = await request(port, { path: '/limited', headers });
    const second = await request(port, { path: '/limited', headers });
    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
    expect(second.headers['retry-after']).toBeDefined();
  });
});

await test('CSRF requires signed header and matching cookie', async () => {
  const app = createApp({ security: { csrf: { enabled: true, secret: '12345678901234567890123456789012' } } });
  app.get('/form', (req, res) => res.json({ form: true }));
  app.post('/submit', (req, res) => res.json({ ok: true }));
  await withServer(app, async (port) => {
    const form = await request(port, { path: '/form' });
    const token = form.headers['x-csrf-token'];
    const cookie = firstCookie(form, 'csrf_token');
    const missing = await request(port, { path: '/submit', method: 'POST' });
    const accepted = await request(port, { path: '/submit', method: 'POST', headers: { 'X-CSRF-Token': token, Cookie: cookie } });
    expect(token).toBeDefined();
    expect(cookie).toBeDefined();
    expect(missing.status).toBe(403);
    expect(accepted.status).toBe(200);
  });
});

await test('untrusted proxy headers cannot spoof req.ip', async () => {
  const app = createApp({ security: { trustedProxies: [] } });
  app.get('/ip', (req, res) => res.json({ ip: req.ip }));
  await withServer(app, async (port) => {
    const response = await request(port, { path: '/ip', headers: { 'X-Forwarded-For': '203.0.113.10' } });
    expect(response.body).notToContain('203.0.113.10');
  });
});

await test('body parser rejects oversized JSON before route handling', async () => {
  const app = createApp();
  app.use(bodyParser({ limit: '4b' }));
  app.post('/body', (req, res) => res.json({ ok: true }));
  await withServer(app, async (port) => {
    const response = await request(port, { path: '/body', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"a":1}' });
    expect(response.status).toBe(413);
  });
});

await test('sanitize() middleware is usable for request cleanup', async () => {
  const app = createApp();
  app.use(sanitize());
  app.get('/clean', (req, res) => res.json({ q: req.query.q }));
  await withServer(app, async (port) => {
    const response = await request(port, { path: '/clean?q=%3Cscript%3Ealert(1)%3C%2Fscript%3E%0D%0A' });
    expect(response.status).toBe(200);
    expect(response.body).notToContain('<script>');
    expect(response.body).notToContain('\\r');
  });
});

await test('response headers strip CRLF injection attempts', async () => {
  const app = createApp();
  app.get('/headers', (req, res) => { res.header('X-Test', 'safe\r\nInjected: yes').json({ ok: true }); });
  await withServer(app, async (port) => {
    const response = await request(port, { path: '/headers' });
    expect(response.status).toBe(200);
    expect(response.headers['x-test']).toBe('safeInjected: yes');
    expect(response.headers.injected).toBeUndefined();
  });
});

console.log('\n3. Docs Tests:');
await test('/docs serves a black interactive UI shell', async () => {
  const app = createApp();
  app.docs({ title: 'Test Docs', apiKeys: ['docs-secret'] });
  await withServer(app, async (port) => {
    const response = await request(port, { path: '/docs' });
    expect(response.status).toBe(200);
    expect(response.body).toContain('Test Docs');
    expect(response.body).toContain('Docs access key');
  });
});

await test('/docs/spec.json requires a docs key', async () => {
  const app = createApp();
  app.get('/hello', (req, res) => res.json({ hello: true }));
  app.docs({ apiKeys: ['docs-secret'] });
  await withServer(app, async (port) => {
    const denied = await request(port, { path: '/docs/spec.json' });
    const allowed = await request(port, { path: '/docs/spec.json', headers: { 'X-Docs-Key': 'docs-secret' } });
    expect( denied.status ).toBe(401);
    expect( allowed.status ).toBe(200);
    expect( allowed.body ).toContain('/hello');
  });
});

await test('/docs/try executes same-origin requests with a docs key', async () => {
  const app = createApp();
  app.use(bodyParser({ limit: '1mb' }));
  app.post('/echo', (req, res) => res.json({ body: req.body }));
  app.documentRoute({ method: 'POST', path: '/echo', summary: 'Echo body', request: { body: { message: 'hello' } }, responses: { '200': { body: { body: { message: 'hello' } } } }});
  app.docs({ apiKeys: ['docs-secret'] });
  await withServer(app, async (port) => {
    const response = await request(port, { path: '/docs/try', method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Docs-Key': 'docs-secret' }, body: JSON.stringify({ method: 'POST', path: '/echo', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: 'hello' }) }) });
    expect(response.status).toBe(200);
    expect(response.body).toContain('"statusCode":200');
    expect(response.body).toContain('hello');
  });
});

console.log('\n4. Validation & Parsing Integration Tests:');
await test('bodyParser parses application/x-www-form-urlencoded payloads', async () => {
  const app = createApp();
  app.use(bodyParser({ limit: '1mb' }));
  app.post('/form', (req, res) => res.json({ body: req.body }));
  await withServer(app, async (port) => {
    const response = await request(port, { path: '/form', method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'name=Ada&role=dev' });
    expect(response.status).toBe(200);
    expect(response.body).toContain('"name":"Ada"');
    expect(response.body).toContain('"role":"dev"');
  });
});

await test('bodyParser rejects invalid JSON early', async () => {
  const app = createApp();
  app.use(bodyParser({ limit: '1mb' }));
  app.post('/json', (req, res) => res.json({ ok: true, body: req.body }));
  await withServer(app, async (port) => {
    const response = await request(port, { path: '/json', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{not-json' });
    expect(response.status).toBe(400);
  });
});

await test('validator middleware returns 400 with structured errors (integration)', async () => {
  const app = createApp();
  app.use(bodyParser({ limit: '1mb' }));
  app.post('/users', validatorMiddleware({ name: { type: 'string', required: true, min: 2 }, email: { type: 'string', required: true } }), (req, res) => res.json({ ok: true, validated: req.validated }));
  await withServer(app, async (port) => {
    const response = await request(port, { path: '/users', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'A' }) });
    expect(response.status).toBe(400);
    expect(response.body).toContain('Validation Failed');
    expect(response.body).toContain('email is required');
  });
});

await test('validator middleware attaches validated payload (integration)', async () => {
  const app = createApp();
  app.use(bodyParser({ limit: '1mb' }));
  app.post('/users', validatorMiddleware({ name: { type: 'string', required: true, min: 2 }, age: { type: 'number' } }), (req, res) => res.json({ ok: true, validated: req.validated }));
  await withServer(app, async (port) => {
    const response = await request(port, { path: '/users', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Ada', age: 36 }) });
    expect(response.status).toBe(200);
    expect(response.body).toContain('"validated"');
    expect(response.body).toContain('"name":"Ada"');
    expect(response.body).toContain('"age":36');
  });
});

await test('route errors return a 500 and keep requestId', async () => {
  const app = createApp();
  app.get('/boom', () => { throw new Error('boom'); });
  await withServer(app, async (port) => {
    const response = await request(port, { path: '/boom' });
    expect(response.status).toBe(500);
    expect(response.headers['x-request-id']).toBeDefined();
    expect(response.body).toContain('requestId');
  });
});

function createMockRes() {
  return {
    statusCode: 200,
    sent: false,
    headers: {},
    payload: undefined,
    header(name, value) { this.headers[String(name).toLowerCase()] = String(value); return this; },
    status(code) { this.statusCode = code; return this; },
    json(data) { this.sent = true; this.payload = data; return this; },
    send() { this.sent = true; return this; },
  };
}

console.log('\n📊 Results:');
console.log(`   Passed: ${passed}`);
console.log(`   Failed: ${failed}`);
console.log('');

if (failed > 0) {
  console.log('❌ Some tests failed!\n');
  process.exit(1);
} else {
  console.log('🎉 All tests passed!\n');
  process.exit(0);
}

// Export utilities for dynamically loaded tests
global.test = test;
global.expect = expect;
global.withServer = withServer;
global.request = request;
global.firstCookie = firstCookie;

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const __dirname = dirname(fileURLToPath(import.meta.url));
async function loadTestsFrom(dir) {
  const { readdirSync } = await import('node:fs');
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      await loadTestsFrom(full);
    } else if (entry.isFile() && entry.name.endsWith('.test.js')) {
      const { pathToFileURL } = await import('node:url');
      await import(pathToFileURL(full).href);
    }
  }
}
await loadTestsFrom(join(__dirname, 'unit'));
await loadTestsFrom(join(__dirname, 'integration'));
