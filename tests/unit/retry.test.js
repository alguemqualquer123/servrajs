import { retry } from '../../dist/resilience/retry.js';

let attempt = 0;
const op = async () => {
  attempt++;
  if (attempt < 3) throw new Error('fail');
  return 'ok';
};

await test('retry succeeds after transient failures', async () => {
  const result = await retry(op, { maxRetries: 5, jitter: false, backoff: 'linear' });
  if (!result.success) throw new Error('retry did not succeed');
  if (result.value !== 'ok') throw new Error('unexpected value');
  if (result.attempts < 3) throw new Error('not enough attempts');
});
