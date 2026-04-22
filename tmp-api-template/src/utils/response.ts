import type { LOAResponse } from '@srvinix/loa';

export function ok(res: LOAResponse, data: unknown) {
  return res.json({ ok: true, data });
}

export function created(res: LOAResponse, data: unknown) {
  return res.status(201).json({ ok: true, data });
}

export function message(res: LOAResponse, statusCode: number, text: string) {
  return res.status(statusCode).json({ ok: statusCode < 400, message: text });
}
