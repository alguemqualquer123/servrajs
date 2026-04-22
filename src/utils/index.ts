/**
 * LOA Framework - Utilities
 */

import { randomUUID } from '../core/crypto';

function generateUUID(): string {
  return randomUUID();
}

export { generateUUID };

class DefaultLogger {
  #prefix: string;
  #level: string;

  constructor(prefix: string = '[LOA]', level: string = 'info') {
    this.#prefix = prefix;
    this.#level = level;
  }

  debug(...args: unknown[]): void {
    if (this.#shouldLog('debug')) {
      console.log(this.#format('debug', ...args));
    }
  }

  info(...args: unknown[]): void {
    if (this.#shouldLog('info')) {
      console.log(this.#format('info', ...args));
    }
  }

  warn(...args: unknown[]): void {
    if (this.#shouldLog('warn')) {
      console.warn(this.#format('warn', ...args));
    }
  }

  error(...args: unknown[]): void {
    console.error(this.#format('error', ...args));
  }

  #shouldLog(level: string): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.#level);
  }

  #format(level: string, ...args: unknown[]): string {
    const timestamp = new Date().toISOString();
    return `${timestamp} ${this.#prefix} [${level.toUpperCase()}] ${args.join(' ')}`;
  }
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  debug(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

export function createLogger(options?: { prefix?: string; level?: LogLevel }): Logger {
  return new DefaultLogger(options?.prefix, options?.level);
}

export function createDefaultLogger(): Logger {
  return new DefaultLogger('[LOA]', 'error');
}

class FastBufferPool {
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
}

export const bufferPool = new FastBufferPool(4096);

export function fastStringify(data: unknown): string {
  return JSON.stringify(data);
}

export function fastParse(json: string): unknown {
  return JSON.parse(json);
}
