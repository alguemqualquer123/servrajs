import { test, expect, createMockRes } from '../testkit.js';
import { cors } from '../../dist/security/cors.js';

function createReq(options) {
  return {
    method: options.method ?? 'GET',
    header(name) {
      const key = String(name).toLowerCase();
      return options.headers?.[key];
    },
  };
}

test('security cors() denies preflight when origin is not allowlisted', () => {
  const mw = cors({ origin: ['https://app.example.com'] });
  const req = createReq({
    method: 'OPTIONS',
    headers: {
      origin: 'https://evil.example',
      'access-control-request-method': 'GET',
    },
  });
  const res = createMockRes();
  let nextCalled = false;

  mw(req, res, () => {
    nextCalled = true;
  });

  expect(nextCalled).toBe(false);
  expect(res.statusCode).toBe(403);
  expect(res.payload?.message).toBe('CORS origin denied');
});

test('security cors() allows preflight when origin is allowlisted', () => {
  const mw = cors({ origin: ['https://app.example.com'], methods: ['GET'] });
  const req = createReq({
    method: 'OPTIONS',
    headers: {
      origin: 'https://app.example.com',
      'access-control-request-method': 'GET',
    },
  });
  const res = createMockRes();
  let nextCalled = false;

  mw(req, res, () => {
    nextCalled = true;
  });

  expect(nextCalled).toBe(false);
  expect(res.statusCode).toBe(204);
  expect(res.headers['access-control-allow-origin']).toBe('https://app.example.com');
});

