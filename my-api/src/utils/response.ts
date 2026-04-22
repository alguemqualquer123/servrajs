import type { ServraResponse } from 'servrajs';

export function ok(res: ServraResponse, data: unknown) {
  return res.json({ ok: true, data });
}

export function created(res: ServraResponse, data: unknown) {
  return res.status(201).json({ ok: true, data });
}

export function message(res: ServraResponse, statusCode: number, text: string) {
  return res.status(statusCode).json({ ok: statusCode < 400, message: text });
}
