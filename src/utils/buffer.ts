/**
 * LOA Framework - Buffer Pool
 * 
 * Pre-allocated buffer pool to reduce GC pressure.
 */

export class BufferPool {
  #pool: Buffer[] = [];
  #size: number;
  #maxSize: number;

  constructor(size: number, maxSize: number = 100) {
    this.#size = size;
    this.#maxSize = maxSize;
  }

  acquire(): Buffer {
    return this.#pool.pop() ?? Buffer.alloc(this.#size);
  }

  release(buffer: Buffer): void {
    if (this.#pool.length < this.#maxSize) {
      buffer.fill(0);
      this.#pool.push(buffer);
    }
  }

  clear(): void {
    this.#pool = [];
  }
}

export const bufferPool = new BufferPool(4096);