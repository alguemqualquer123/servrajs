/**
 * Servra - Circuit Breaker
 * 
 * Circuit breaker pattern for resilience.
 */

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  successThreshold?: number;
  timeout?: number;
  resetTimeout?: number;
  monitor?: (state: CircuitState) => void;
}

export enum CircuitState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open',
}

const DEFAULT_FAILURE_THRESHOLD = 5;
const DEFAULT_SUCCESS_THRESHOLD = 3;
const DEFAULT_TIMEOUT = 60000;
const DEFAULT_RESET_TIMEOUT = 30000;

export class CircuitBreaker {
  #name: string;
  #failureThreshold: number;
  #successThreshold: number;
  #timeout: number;
  #resetTimeout: number;
  #monitor?: (state: CircuitState) => void;

  #state: CircuitState = CircuitState.CLOSED;
  #failureCount = 0;
  #successCount = 0;
  #lastFailureTime = 0;
  #lastAttemptTime = 0;

  constructor(
    name: string,
    options: CircuitBreakerOptions = {}
  ) {
    this.#name = name;
    this.#failureThreshold = options.failureThreshold ?? DEFAULT_FAILURE_THRESHOLD;
    this.#successThreshold = options.successThreshold ?? DEFAULT_SUCCESS_THRESHOLD;
    this.#timeout = options.timeout ?? DEFAULT_TIMEOUT;
    this.#resetTimeout = options.resetTimeout ?? DEFAULT_RESET_TIMEOUT;
    this.#monitor = options.monitor;
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    this.#checkState();

    if (this.#state === CircuitState.OPEN) {
      throw new Error(`Circuit ${this.#name} is OPEN`);
    }

    this.#lastAttemptTime = Date.now();

    try {
      const result = await operation();
      this.#onSuccess();
      return result;
    } catch (error) {
      this.#onFailure();
      throw error;
    }
  }

  #checkState(): void {
    const now = Date.now();

    if (this.#state === CircuitState.OPEN) {
      if (now - this.#lastFailureTime >= this.#resetTimeout) {
        this.#transitionTo(CircuitState.HALF_OPEN);
      }
    }
  }

  #onSuccess(): void {
    this.#failureCount = 0;

    if (this.#state === CircuitState.HALF_OPEN) {
      this.#successCount++;
      if (this.#successCount >= this.#successThreshold) {
        this.#transitionTo(CircuitState.CLOSED);
      }
    }
  }

  #onFailure(): void {
    this.#failureCount++;
    this.#lastFailureTime = Date.now();

    if (this.#failureCount >= this.#failureThreshold) {
      this.#transitionTo(CircuitState.OPEN);
    }
  }

  #transitionTo(state: CircuitState): void {
    this.#state = state;
    this.#monitor?.(state);
  }

  get state(): CircuitState {
    return this.#state;
  }

  get name(): string {
    return this.#name;
  }

  get failureCount(): number {
    return this.#failureCount;
  }

  reset(): void {
    this.#state = CircuitState.CLOSED;
    this.#failureCount = 0;
    this.#successCount = 0;
  }
}

const breakers = new Map<string, CircuitBreaker>();

export function getBreaker(name: string, options?: CircuitBreakerOptions): CircuitBreaker {
  let breaker = breakers.get(name);
  if (!breaker) {
    breaker = new CircuitBreaker(name, options);
    breakers.set(name, breaker);
  }
  return breaker;
}

export function registerBreaker(name: string, breaker: CircuitBreaker): void {
  breakers.set(name, breaker);
}

export function listBreakers(): CircuitBreaker[] {
  return Array.from(breakers.values());
}

export default { CircuitBreaker, CircuitState, getBreaker, registerBreaker, listBreakers };
