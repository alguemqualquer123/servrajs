/**
 * LOA Framework - Simple Test Runner
 * Run: node tests/index.js
 */

import { request as httpRequest } from 'node:http';
import { createApp, bodyParser, sanitize } from '../dist/index.js';

// We'll test basic imports work by checking the app has the expected methods
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

console.log('\n🧪 LOA Framework Tests\n');

console.log('1. Application Tests:');

await test('createApp() creates application', () => {
  const app = createApp();
  expect(app).toBeDefined();
});

await test('createApp() has router', () => {
  const app = createApp();
  expect(app.router).toBeDefined();
});

await test('createApp() has logger', () => {
  const app = createApp();
  expect(app.logger).toBeDefined();
});

await test('createApp() has get method', () => {
  const app = createApp();
  expect(typeof app.get).toBe('function');
});

await test('createApp() has post method', () => {
  const app = createApp();
  expect(typeof app.post).toBe('function');
});

await test('createApp() has use method', () => {
  const app = createApp();
  expect(typeof app.use).toBe('function');
});

await test('createApp() has listen method', () => {
  const app = createApp();
  expect(typeof app.listen).toBe('function');
});

await test('createApp() accepts security options', () => {
  const app = createApp({ 
    security: { 
      enabled: true,
      helmet: { contentSecurityPolicy: true }
    } 
  });
  expect(app).toBeDefined();
});

await test('createApp() routes work', () => {
  const app = createApp();
  app.get('/hello', (req, res) => {
    res.json({ message: 'Hello!' });
  });
  expect(app).toBeDefined();
});

await test('createApp() supports route groups', () => {
  const app = createApp();
  app.group('/api', () => {
    app.get('/users', (req, res) => res.json({ users: [] }));
  });
  expect(app).toBeDefined();
});

await test('createApp() supports middleware', () => {
  const app = createApp();
  app.use((req, res, next) => {
    next();
  });
  expect(app).toBeDefined();
});

await test('createApp() can disable security', () => {
  const app = createApp({ security: { enabled: false } });
  expect(app).toBeDefined();
});

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
    const response = await request(port, {
      path: '/secure',
      method: 'OPTIONS',
      headers: {
        Origin: 'https://evil.example',
        'Access-Control-Request-Method': 'GET',
      },
    });
    expect(response.status).toBe(403);
  });
});

await test('configured CORS allows a trusted origin only', async () => {
  const app = createApp({
    security: {
      cors: {
        origin: 'https://app.example.com',
      },
    },
  });
  app.get('/secure', (req, res) => res.json({ ok: true }));

  await withServer(app, async (port) => {
    const allowed = await request(port, {
      path: '/secure',
      headers: { Origin: 'https://app.example.com' },
    });
    const denied = await request(port, {
      path: '/secure',
      headers: { Origin: 'https://evil.example' },
    });

    expect(allowed.headers['access-control-allow-origin']).toBe('https://app.example.com');
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });
});

await test('rate limit blocks excess requests quickly', async () => {
  const app = createApp({
    security: {
      rateLimit: {
        max: 1,
        keyGenerator: (req) => req.header('x-rate-key') || req.ip,
      },
    },
  });
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
  const app = createApp({
    security: {
      csrf: {
        enabled: true,
        secret: '12345678901234567890123456789012',
      },
    },
  });
  app.get('/form', (req, res) => res.json({ form: true }));
  app.post('/submit', (req, res) => res.json({ ok: true }));

  await withServer(app, async (port) => {
    const form = await request(port, { path: '/form' });
    const token = form.headers['x-csrf-token'];
    const cookie = firstCookie(form, 'csrf_token');
    const missing = await request(port, { path: '/submit', method: 'POST' });
    const accepted = await request(port, {
      path: '/submit',
      method: 'POST',
      headers: {
        'X-CSRF-Token': token,
        Cookie: cookie,
      },
    });

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
    const response = await request(port, {
      path: '/ip',
      headers: { 'X-Forwarded-For': '203.0.113.10' },
    });

    expect(response.body).notToContain('203.0.113.10');
  });
});

await test('body parser rejects oversized JSON before route handling', async () => {
  const app = createApp();
  app.use(bodyParser({ limit: '4b' }));
  app.post('/body', (req, res) => res.json({ ok: true }));

  await withServer(app, async (port) => {
    const response = await request(port, {
      path: '/body',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"a":1}',
    });

    expect(response.status).toBe(413);
  });
});

await test('sanitize() middleware is usable for request cleanup', async () => {
  const app = createApp();
  app.use(sanitize());
  app.get('/clean', (req, res) => res.json({ q: req.query.q }));

  await withServer(app, async (port) => {
    const response = await request(port, {
      path: '/clean?q=%3Cscript%3Ealert(1)%3C%2Fscript%3E%0D%0A',
    });

    expect(response.status).toBe(200);
    expect(response.body).notToContain('<script>');
    expect(response.body).notToContain('\\r');
  });
});

await test('response headers strip CRLF injection attempts', async () => {
  const app = createApp();
  app.get('/headers', (req, res) => {
    res.header('X-Test', 'safe\r\nInjected: yes').json({ ok: true });
  });

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
  app.docs({
    title: 'Test Docs',
    apiKeys: ['docs-secret'],
  });

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
    const allowed = await request(port, {
      path: '/docs/spec.json',
      headers: { 'X-Docs-Key': 'docs-secret' },
    });

    expect(denied.status).toBe(401);
    expect(allowed.status).toBe(200);
    expect(allowed.body).toContain('/hello');
  });
});

await test('/docs/try executes same-origin requests with a docs key', async () => {
  const app = createApp();
  app.use(bodyParser({ limit: '1mb' }));
  app.post('/echo', (req, res) => res.json({ body: req.body }));
  app.documentRoute({
    method: 'POST',
    path: '/echo',
    summary: 'Echo body',
    request: {
      body: { message: 'hello' },
    },
    responses: {
      '200': {
        body: { body: { message: 'hello' } },
      },
    },
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
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({ message: 'hello' }),
      }),
    });

    expect(response.status).toBe(200);
    expect(response.body).toContain('"statusCode":200');
    expect(response.body).toContain('hello');
  });
});

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
