import { createSSE } from '../../dist/protocols/sse.js';
import { EventEmitter } from 'node:events';

function mockReq() { return { header: () => undefined, query: {} }; }
function mockRes() {
  const raw = new EventEmitter();
  raw.writableEnded = false;
  raw.write = (data) => { raw.emittedData = (raw.emittedData ?? '') + data; };
  raw.end = () => { raw.writableEnded = true; };
  return {
    header: () => undefined,
    raw,
    json: () => {},
    status: () => ({ send: () => {} }),
  };
}

await test('SSE creates response with sse method', async () => {
  const req = mockReq();
  const res = mockRes();
  const sseRes = createSSE(req, res);
  if (typeof sseRes.sse !== 'function') throw new Error('sse method missing');
  sseRes.sse('test', { a: 1 });
  if (!res.raw.emittedData.includes('event: test')) throw new Error('event not written');
});
