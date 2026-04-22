import { compression } from '../../dist/utils/compression.js';
import { test, expect, } from '../testkit.js';

/** Simple mock objects */
function createMockReq(headers = {}) {
  return {
    header(name) { return headers[name.toLowerCase()]; },
  };
}

function createMockRes() {
  let jsonCalled = false;
  let endCalled = false;
  return {
    statusCode: 200,
    raw: {
      end() { endCalled = true; },
    },
    json(data) { jsonCalled = true; return this; },
    get called() { return { jsonCalled, endCalled }; },
  };
}

await test('compression middleware skips when disabled', async () => {
  const req = createMockReq({});
  const res = createMockRes();
  let nextCalled = false;
  const mw = compression({ enabled: false });
  mw(req, res, () => { nextCalled = true; });
  if (!nextCalled) throw new Error('next not called');
});

await test('compression middleware skips when client does not accept gzip', async () => {
  const req = createMockReq({ 'accept-encoding': '' });
  const res = createMockRes();
  let nextCalled = false;
  const mw = compression();
  mw(req, res, () => { nextCalled = true; });
  if (!nextCalled) throw new Error('next not called');
});
