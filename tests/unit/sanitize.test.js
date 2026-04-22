import { test, expect, createMockRes } from '../testkit.js';
import { sanitize, sanitizeObject, sanitizePath, sanitizeHeaders } from '../../dist/security/sanitizer.js';

test('sanitize() escapes XSS payloads by default', () => {
  const out = sanitize('<script>alert(1)</script>');
  expect(out).notToContain('<script>');
  expect(out).toContain('&lt;');
});

test('sanitizeHeaders() removes CRLF sequences', () => {
  expect(sanitizeHeaders('ok\r\nInjected: yes')).toBe('okInjected: yes');
});

test('sanitizePath() removes traversal patterns', () => {
  expect(sanitizePath('../etc/passwd')).notToContain('..');
  expect(sanitizePath('..\\..\\a')).notToContain('..');
});

test('sanitizeObject() removes prototype pollution keys recursively', () => {
  const input = {
    ok: true,
    '__proto__': { polluted: true },
    nested: { constructor: { a: 1 }, safe: '<b>hi</b>' },
  };

  const out = sanitizeObject(input);
  expect(Object.prototype.hasOwnProperty.call(out, '__proto__')).toBe(false);
  expect(Object.prototype.hasOwnProperty.call(out.nested, 'constructor')).toBe(false);
  expect(out.nested.safe).notToContain('<b>');
});

test('sanitize() middleware sanitizes req.query and req.body', () => {
  const mw = sanitize();
  const req = {
    query: { q: '<script>1</script>\r\n' },
    params: {},
    body: { name: '<img src=x onerror=alert(1)>' },
  };
  const res = createMockRes();
  let nextCalled = false;

  mw(req, res, () => { nextCalled = true; });

  expect(nextCalled).toBe(true);
  expect(req.query.q).notToContain('<script>');
  expect(req.query.q).notToContain('\r');
  expect(req.body.name).notToContain('<img');
});
