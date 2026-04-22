import { PassThrough } from 'node:stream';
import { test, expect, createMockRes } from '../testkit.js';
import { bodyParser } from '../../dist/index.js';

function createReq(options) {
  const raw = new PassThrough();
  raw.end(options.body ?? '');

  return {
    id: '1',
    raw,
    body: {},
    header(name) {
      const key = String(name).toLowerCase();
      return options.headers?.[key];
    },
    setBody(body) {
      this.body = body;
    },
  };
}

test('bodyParser skips when content-type is not json or form', async () => {
  const req = createReq({ headers: { 'content-type': 'text/plain' }, body: 'hello' });
  const res = createMockRes();
  let nextCalled = false;

  await bodyParser()(req, res, () => {
    nextCalled = true;
  });

  expect(nextCalled).toBe(true);
  expect(req.body && Object.keys(req.body).length).toBe(0);
});

test('bodyParser parses JSON object', async () => {
  const req = createReq({
    headers: { 'content-type': 'application/json' },
    body: '{"a":1}',
  });
  const res = createMockRes();
  let nextCalled = false;

  await bodyParser()(req, res, () => {
    nextCalled = true;
  });

  expect(nextCalled).toBe(true);
  expect(req.body.a).toBe(1);
});

test('bodyParser rejects invalid JSON with 400', async () => {
  const req = createReq({
    headers: { 'content-type': 'application/json' },
    body: '{not-json',
  });
  const res = createMockRes();
  let nextError;

  await bodyParser()(req, res, (err) => {
    nextError = err;
  });

  expect(nextError).toBeDefined();
  expect(nextError.statusCode).toBe(400);
});

test('bodyParser strict mode rejects JSON primitives', async () => {
  const req = createReq({
    headers: { 'content-type': 'application/json' },
    body: '"hello"',
  });
  const res = createMockRes();
  let nextError;

  await bodyParser({ strict: true })(req, res, (err) => {
    nextError = err;
  });

  expect(nextError).toBeDefined();
  expect(nextError.statusCode).toBe(400);
});

test('bodyParser non-strict mode accepts JSON primitives', async () => {
  const req = createReq({
    headers: { 'content-type': 'application/json' },
    body: '"hello"',
  });
  const res = createMockRes();
  let nextCalled = false;

  await bodyParser({ strict: false })(req, res, () => {
    nextCalled = true;
  });

  expect(nextCalled).toBe(true);
  expect(req.body).toBe('hello');
});

test('bodyParser parses x-www-form-urlencoded bodies', async () => {
  const req = createReq({
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: 'name=Ada&role=dev',
  });
  const res = createMockRes();
  let nextCalled = false;

  await bodyParser()(req, res, () => {
    nextCalled = true;
  });

  expect(nextCalled).toBe(true);
  expect(req.body.name).toBe('Ada');
  expect(req.body.role).toBe('dev');
});

