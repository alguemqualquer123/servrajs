import { acquireBuffer, releaseBuffer, getPoolStats } from '../../dist/utils/pool.js';
import { test, expect, createMockRes } from '../testkit.js';

await test('Buffer pool acquire/release updates stats', async () => {
  const buf = acquireBuffer();
  if (!Buffer.isBuffer(buf)) throw new Error('not a Buffer');
  const statsBefore = getPoolStats().buffer;
  releaseBuffer(buf);
  const statsAfter = getPoolStats().buffer;
  if (statsAfter.active !== statsBefore.active - 1) throw new Error('active count not decremented');
});
