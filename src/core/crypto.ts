import {
  createHash as nodeCreateHash,
  createHmac,
  randomBytes as nodeRandomBytes,
  randomUUID as nodeRandomUUID,
  timingSafeEqual,
} from 'node:crypto';

export function randomUUID(): string {
  return nodeRandomUUID();
}

export function sha256(data: string): string {
  return nodeCreateHash('sha256').update(data).digest('hex');
}

export function hmacSha256(data: string, secret: string): string {
  return createHmac('sha256', secret).update(data).digest('hex');
}

export function randomBytes(size: number): Uint8Array {
  if (!Number.isInteger(size) || size < 0) {
    throw new RangeError('randomBytes size must be a non-negative integer');
  }

  return nodeRandomBytes(size);
}

export function secureCompare(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}

export function createHash(algorithm: string) {
  return nodeCreateHash(algorithm);
}
