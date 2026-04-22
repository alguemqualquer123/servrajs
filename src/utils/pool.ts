/**
 * Servra - Object Pool
 * 
 * High-performance object pooling to reduce GC pressure.
 * Uses pre-allocated objects for hot paths.
 */

const DEFAULT_POOL_SIZE = 1000;
const MAX_POOL_SIZE = 10000;

interface PoolConfig {
  maxSize?: number;
  factory: () => unknown;
  reset?: (obj: unknown) => void;
}

class ObjectPool {
  #objects: unknown[] = [];
  #maxSize: number;
  #factory: () => unknown;
  #reset: (obj: unknown) => void;
  #activeCount = 0;

  constructor(config: PoolConfig) {
    this.#maxSize = config.maxSize ?? DEFAULT_POOL_SIZE;
    this.#factory = config.factory;
    this.#reset = config.reset ?? (() => {});
  }

  acquire(): unknown {
    this.#activeCount++;
    
    if (this.#objects.length > 0) {
      const obj = this.#objects.pop()!;
      return obj;
    }

    return this.#factory();
  }

  release(obj: unknown): void {
    if (!obj) return;

    this.#activeCount--;
    this.#reset(obj);

    if (this.#objects.length < this.#maxSize) {
      this.#objects.push(obj);
    }
  }

  get size(): number {
    return this.#objects.length;
  }

  get active(): number {
    return this.#activeCount;
  }

  get total(): number {
    return this.#objects.length + this.#activeCount;
  }

  clear(): void {
    this.#objects = [];
    this.#activeCount = 0;
  }

  trim(excess: number): void {
    const targetSize = Math.min(this.#maxSize, this.#objects.length - excess);
    this.#objects.length = Math.max(0, targetSize);
  }
}

const requestParamsPool = new ObjectPool({
  maxSize: MAX_POOL_SIZE,
  factory: () => ({}),
  reset: (obj) => {
    const target = obj as Record<string, unknown>;
    for (const key of Object.keys(target)) {
      delete target[key];
    }
  },
});

const queryPool = new ObjectPool({
  maxSize: MAX_POOL_SIZE,
  factory: () => ({}),
  reset: (obj) => {
    const target = obj as Record<string, unknown>;
    for (const key of Object.keys(target)) {
      delete target[key];
    }
  },
});

const bufferPool = new ObjectPool({
  maxSize: MAX_POOL_SIZE,
  factory: () => Buffer.alloc(4096),
  reset: (obj) => {
    (obj as Buffer).fill(0);
  },
});

export function acquireRequestParams(): Record<string, unknown> {
  return requestParamsPool.acquire() as Record<string, unknown>;
}

export function releaseRequestParams(obj: Record<string, unknown>): void {
  requestParamsPool.release(obj);
}

export function acquireQuery(): Record<string, unknown> {
  return queryPool.acquire() as Record<string, unknown>;
}

export function releaseQuery(obj: Record<string, unknown>): void {
  queryPool.release(obj);
}

export function acquireBuffer(): Buffer {
  return bufferPool.acquire() as Buffer;
}

export function releaseBuffer(obj: Buffer): void {
  bufferPool.release(obj);
}

export function getPoolStats() {
  return {
    requestParams: {
      size: requestParamsPool.size,
      active: requestParamsPool.active,
      total: requestParamsPool.total,
    },
    query: {
      size: queryPool.size,
      active: queryPool.active,
      total: queryPool.total,
    },
    buffer: {
      size: bufferPool.size,
      active: bufferPool.active,
      total: bufferPool.total,
    },
  };
}

export function clearPools(): void {
  requestParamsPool.clear();
  queryPool.clear();
  bufferPool.clear();
}

export function trimPools(excess = 100): void {
  requestParamsPool.trim(excess);
  queryPool.trim(excess);
  bufferPool.trim(excess);
}

export default ObjectPool;
