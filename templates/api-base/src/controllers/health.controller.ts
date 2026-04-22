import type { LOARequest, LOAResponse } from '__PACKAGE_NAME__';

const startedAt = new Date();

export function health(req: LOARequest, res: LOAResponse) {
  return res.json({
    ok: true,
    status: 'healthy',
    uptimeSeconds: Math.round(process.uptime()),
    startedAt: startedAt.toISOString(),
    requestId: req.id,
  });
}
