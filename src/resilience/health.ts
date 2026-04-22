/**
 * Servra - Health Checks
 * 
 * Comprehensive health check system.
 */

import type { LOAApplication } from '../core/application';

export interface HealthCheckOptions {
  enabled?: boolean;
  path?: string;
  detailed?: boolean;
  includeDeps?: boolean;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: number;
  uptime: number;
  version?: string;
  checks: Record<string, HealthCheckResult>;
  deps?: Record<string, DependencyStatus>;
}

export interface HealthCheckResult {
  status: 'pass' | 'fail' | 'warn';
  message?: string;
  duration?: number;
}

export interface DependencyStatus {
  status: 'pass' | 'fail' | 'warn';
  latency?: number;
  error?: string;
}

type HealthCheckFn = () => HealthCheckResult | Promise<HealthCheckResult>;
type DependencyCheckFn = (url: string) => Promise<DependencyStatus>;

const DEFAULT_PATH = '/health';
const registeredChecks = new Map<string, HealthCheckFn>();
const registeredDeps = new Map<string, DependencyCheckFn>();

let app: LOAApplication | null = null;
let startTime = Date.now();

export function setupHealthChecks(loaApp: LOAApplication, options: HealthCheckOptions = {}): void {
  app = loaApp;
  const path = options.path ?? DEFAULT_PATH;

  loaApp.get(path, async (req, res) => {
    const detailed = req.query.detailed === 'true' || options.detailed;
    const includeDeps = req.query.deps === 'true' || options.includeDeps;

    const health = await getHealthStatus(detailed, includeDeps);
    res.status(health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503);
    res.json(health);
  });

  loaApp.get(`${path}/live`, (req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  loaApp.get(`${path}/ready`, async (req, res) => {
    const health = await getHealthStatus(false, false);
    res.status(health.status === 'healthy' ? 200 : 503);
    res.json({ status: health.status });
  });
}

export function registerCheck(name: string, fn: HealthCheckFn): void {
  registeredChecks.set(name, fn);
}

export function registerDependency(name: string, fn: DependencyCheckFn): void {
  registeredDeps.set(name, fn);
}

export async function getHealthStatus(detailed = false, includeDeps = false): Promise<HealthStatus> {
  const checks: Record<string, HealthCheckResult> = {};
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  const results: Array<{status: string; result: HealthCheckResult}> = [];

  for (const [name, fn] of registeredChecks) {
    const start = Date.now();
    try {
      const result = await fn();
      checks[name] = result;
      results.push({ status: name, result });
    } catch (error) {
      checks[name] = { status: 'fail', message: (error as Error).message };
      results.push({ status: name, result: checks[name] });
    }
  }

  for (const r of results) {
    if (r.result.status === 'fail') {
      overallStatus = 'unhealthy';
      break;
    }
    if (r.result.status === 'warn') {
      overallStatus = 'degraded';
    }
  }

  const deps: Record<string, DependencyStatus> = {};
  if (includeDeps) {
    for (const [name, fn] of registeredDeps) {
      try {
        let url = name;
        if (name.startsWith('http')) {
          const result = await fn(url);
          deps[name] = result;
          
          if (result.status === 'fail') {
            overallStatus = 'unhealthy';
          } else if (result.status === 'warn' && overallStatus === 'healthy') {
            overallStatus = 'degraded';
          }
        }
      } catch (error) {
        deps[name] = { status: 'fail', error: (error as Error).message };
        overallStatus = 'unhealthy';
      }
    }
  }

  return {
    status: overallStatus,
    timestamp: Date.now(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
    version: process.env.APP_VERSION,
    checks: detailed ? checks : {},
    deps: includeDeps ? deps : undefined,
  };
}

export function addDefaultChecks(): void {
  registerCheck('memory', () => {
    const used = process.memoryUsage();
    const heapUsedMB = Math.round(used.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(used.heapTotal / 1024 / 1024);
    const usage = (used.heapUsed / used.heapTotal) * 100;

    return {
      status: usage > 90 ? 'fail' : usage > 75 ? 'warn' : 'pass',
      message: `${heapUsedMB}/${heapTotalMB} MB`,
    };
  });

  registerCheck('cpu', () => {
    const load = require('os').loadavg();
    const cores = require('os').cpus().length;
    const usage = (load[0] / cores) * 100;

    return {
      status: usage > 80 ? 'fail' : usage > 60 ? 'warn' : 'pass',
      message: `Load: ${load[0].toFixed(2)}`,
    };
  });

  registerCheck('eventLoop', () => {
    const start = Date.now();
    return new Promise(resolve => {
      setImmediate(() => {
        const lag = Date.now() - start;
        resolve({
          status: lag > 100 ? 'fail' : lag > 50 ? 'warn' : 'pass',
          message: `${lag}ms`,
        });
      });
    });
  });
}

export default {
  setupHealthChecks,
  registerCheck,
  registerDependency,
  getHealthStatus,
  addDefaultChecks,
};
