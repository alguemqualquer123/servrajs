import type { ServraRequest, ServraResponse } from 'servra';

export function errorHandler(error: Error, req: ServraRequest, res: ServraResponse) {
  const candidate = error as Error & {
    statusCode?: number;
    status?: number;
    details?: unknown;
  };

  const statusCode = normalizeStatus(candidate.statusCode ?? candidate.status);
  const response: Record<string, unknown> = {
    ok: false,
    error: statusCode >= 500 ? 'Internal Server Error' : candidate.message,
    statusCode,
    requestId: req.id,
  };

  if (candidate.details !== undefined) {
    response.details = candidate.details;
  }

  return res.status(statusCode).json(response);
}

function normalizeStatus(statusCode: unknown): number {
  return typeof statusCode === 'number' && statusCode >= 400 && statusCode <= 599
    ? statusCode
    : 500;
}
