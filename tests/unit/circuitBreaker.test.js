import { getBreaker } from '../../dist/resilience/circuit-breaker.js';
import { CircuitState } from '../../dist/resilience/circuit-breaker.js';
import { test, expect, createMockRes } from '../testkit.js';

await test('CircuitBreaker opens after failures', async () => {
  const breaker = getBreaker('testBreaker', { failureThreshold: 2, resetTimeout: 1000 });
  const failingOp = () => Promise.reject(new Error('fail'));
  try { await breaker.execute(failingOp); } catch {}
  try { await breaker.execute(failingOp); } catch {}
  if (breaker.state !== CircuitState.OPEN) throw new Error('breaker not open');
});
