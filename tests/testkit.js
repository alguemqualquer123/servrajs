import { request as httpRequest } from 'node:http';
import { readdirSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const tests = [];

export function test(name, fn) {
  tests.push({ name, fn });
}

export function expect(value) {
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
    },
  };
}

export async function runAll() {
  let passed = 0;
  let failed = 0;

  for (const t of tests) {
    try {
      await t.fn();
      console.log(`  ✅ ${t.name}`);
      passed++;
    } catch (error) {
      console.log(`  ❌ ${t.name}`);
      console.log(`     Error: ${error instanceof Error ? error.message : String(error)}`);
      failed++;
    }
  }

  console.log('\n📊 Results:');
  console.log(`   Passed: ${passed}`);
  console.log(`   Failed: ${failed}`);
  console.log('');

  if (failed > 0) {
    console.log('❌ Some tests failed!\n');
    process.exitCode = 1;
  } else {
    console.log('🎉 All tests passed!\n');
    process.exitCode = 0;
  }
}

export async function loadTestModules() {
  const root = dirnameOf(import.meta.url);
  const folders = ['unit', 'integration'];

  for (const folder of folders) {
    const dir = join(root, folder);
    const entries = safeReadDir(dir)
      .filter((name) => extname(name).toLowerCase() === '.js')
      .filter((name) => name.endsWith('.test.js'))
      .sort((a, b) => a.localeCompare(b));

    for (const entry of entries) {
      const fileUrl = pathToFileURL(join(dir, entry)).href;
      await import(fileUrl);
    }
  }
}

function safeReadDir(dir) {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}

function dirnameOf(metaUrl) {
  return fileURLToPath(new URL('.', metaUrl));
}

export async function withServer(app, fn) {
  const server = await app.listen(0, '127.0.0.1');
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;

  try {
    return await fn(port);
  } finally {
    await app.close();
  }
}

export function request(port, options = {}) {
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

export function firstCookie(response, name) {
  const cookies = response.headers['set-cookie'] ?? [];
  const list = Array.isArray(cookies) ? cookies : [cookies];
  const match = list.find((cookie) => cookie.startsWith(`${name}=`));
  return match?.split(';')[0];
}

export function createMockRes() {
  return {
    statusCode: 200,
    sent: false,
    headers: {},
    payload: undefined,
    header(name, value) {
      this.headers[String(name).toLowerCase()] = String(value);
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.sent = true;
      this.payload = data;
      return this;
    },
    html(data) {
      this.sent = true;
      this.payload = data;
      return this;
    },
    send() {
      this.sent = true;
      return this;
    },
  };
}

