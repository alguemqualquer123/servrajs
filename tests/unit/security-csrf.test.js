import { test, expect, createMockRes } from '../testkit.js';
import { csrf } from '../../dist/security/csrf.js';

function createReq(options) {
  return {
    method: options.method ?? 'GET',
    header(name) {
      const key = String(name).toLowerCase();
      return options.headers?.[key];
    },
    cookie(name) {
      return options.cookies?.[name];
    },
  };
}

function attachCookieApi(res) {
  res.cookies = {};
  res.cookie = (name, value) => {
    res.cookies[name] = value;
    return res;
  };
  return res;
}

test('csrf() when enabled issues token on safe methods', () => {
  const mw = csrf({ enabled: true, secret: 'x'.repeat(64) });
  const req = createReq({ method: 'GET', headers: {} });
  const res = attachCookieApi(createMockRes());
  let nextCalled = false;

  mw(req, res, () => { nextCalled = true; });

  expect(nextCalled).toBe(true);
  expect(res.headers['x-csrf-token']).toBeDefined();
  expect(res.cookies.csrf_token).toBeDefined();
});

test('csrf() blocks unsafe methods without valid token', () => {
  const mw = csrf({ enabled: true, secret: 'x'.repeat(64) });
  const req = createReq({ method: 'POST', headers: {} });
  const res = attachCookieApi(createMockRes());

  mw(req, res, () => {});

  expect(res.statusCode).toBe(403);
  expect(res.payload?.message).toBe('Invalid CSRF token');
});

