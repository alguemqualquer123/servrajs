/**
 * Servra - Benchmark Tests
 * 
 * Compares performance between Servra, Express, and Fastify.
 * Run with: node tests/benchmark/index.js
 */

import { request } from 'http';

// ============================================================================
// Test Configuration
// ============================================================================

const CONFIG = {
  duration: 5000,  // 5 seconds per test
  concurrency: 200,
  host: 'localhost',
  port: 3001,
};

// ============================================================================
// Request Helper
// ============================================================================

function makeHttpRequest(port) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const req = request({
      hostname: CONFIG.host,
      port,
      path: '/test',
      method: 'GET',
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          duration: Date.now() - start,
          size: data.length,
        });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// ============================================================================
// Benchmark Runner
// ============================================================================

async function runBenchmark(name, server) {
  return new Promise((resolve) => {
    const results = [];
    let activeRequests = 0;
    let completed = false;
    const startTime = Date.now();
    const endTime = startTime + CONFIG.duration;

    const maybeFinish = () => {
      if (completed && activeRequests === 0) {
        resolve(calculateResults(results));
      }
    };

    const makeRequests = () => {
      const now = Date.now();
      if (now >= endTime) {
        completed = true;
        maybeFinish();
        return;
      }

      while (activeRequests < CONFIG.concurrency) {
        activeRequests++;
        makeHttpRequest(server.address().port)
          .then((result) => {
            results.push(result);
            activeRequests--;
            maybeFinish();
            makeRequests();
          })
          .catch(() => {
            activeRequests--;
            maybeFinish();
            makeRequests();
          });
      }
    };

    makeRequests();
  });
}

function calculateResults(results) {
  const total = results.length;
  if (total === 0) {
    return {
      total: 0,
      avg: 0,
      p50: 0,
      p90: 0,
      p99: 0,
      min: 0,
      max: 0,
      rps: 0,
    };
  }
  const durations = results.map((r) => r.duration).sort((a, b) => a - b);
  
  const sum = durations.reduce((a, b) => a + b, 0);
  const avg = sum / total;
  
  return {
    total,
    avg,
    p50: durations[Math.floor(total * 0.5)],
    p90: durations[Math.floor(total * 0.9)],
    p99: durations[Math.floor(total * 0.99)],
    min: durations[0],
    max: durations[total - 1],
    rps: Math.round(total / (CONFIG.duration / 1000)),
  };
}

// ============================================================================
// Express Server
// ============================================================================

let expressApp;
try {
  expressApp = (await import('express')).default;
} catch {
  expressApp = null;
}

function createExpressServer() {
  if (!expressApp) return null;
  
  const app = expressApp();
  
  app.get('/test', (req, res) => {
    res.json({ ok: true });
  });
  
  return app;
}

// ============================================================================
// Fastify Server
// ============================================================================

let fastify;
try {
  fastify = (await import('fastify')).default;
} catch {
  fastify = null;
}

async function createFastifyServer() {
  if (!fastify) return null;
  
  const app = fastify();
  
  app.get('/test', async () => {
    return { ok: true };
  });
  
  return app;
}

// ============================================================================
// Servra Server
// ============================================================================

async function createServraServer() {
  const { createApp } = await import('../../dist/index.js');
  
  const app = createApp({
    dev: false,
    debug: false,
    security: { enabled: false },
  });
  
  app.get('/test', (req, res) => {
    return res.json({ ok: true });
  });
  
  return app;
}

// ============================================================================
// Main Benchmark
// ============================================================================

async function runBenchmarks() {
  console.log('\n🧪 Servra Benchmark\n');
  console.log(`Configuration:`);
  console.log(`  Duration: ${CONFIG.duration}ms per test`);
  console.log(`  Concurrency: ${CONFIG.concurrency} requests\n`);
  
  const results = [];
  
  // Test Servra
  console.log('Testing Servra...');
  const servraApp = await createServraServer();
  const servraServer = await servraApp.listen(CONFIG.port);
  const servraResult = await runBenchmark('servra', servraServer);
  await servraApp.close();
  results.push({ name: 'Servra', ...servraResult });
  console.log(`  Requests: ${servraResult.total.toLocaleString()}`);
  console.log(`  RPS: ${servraResult.rps.toLocaleString()}`);
  console.log(`  Avg: ${servraResult.avg.toFixed(2)}ms`);
  console.log(`  p50: ${servraResult.p50}ms`);
  console.log(`  p99: ${servraResult.p99}ms\n`);
  
  // Test Fastify (if available)
  if (fastify) {
    console.log('Testing Fastify...');
    const fastifyApp = await createFastifyServer();
    await fastifyApp.listen({ port: CONFIG.port });
    const fastifyResult = await runBenchmark('fastify', fastifyApp.server);
    await fastifyApp.close();
    results.push({ name: 'Fastify', ...fastifyResult });
    console.log(`  Requests: ${fastifyResult.total.toLocaleString()}`);
    console.log(`  RPS: ${fastifyResult.rps.toLocaleString()}`);
    console.log(`  Avg: ${fastifyResult.avg.toFixed(2)}ms`);
    console.log(`  p50: ${fastifyResult.p50}ms`);
    console.log(`  p99: ${fastifyResult.p99}ms\n`);
  }
  
  // Test Express (if available)
  if (expressApp) {
    console.log('Testing Express...');
    const expressServer = createExpressServer();
    const expressHttp = expressServer.listen(CONFIG.port);
    const expressResult = await runBenchmark('express', expressHttp);
    await new Promise((resolve) => expressHttp.close(resolve));
    results.push({ name: 'Express', ...expressResult });
    console.log(`  Requests: ${expressResult.total.toLocaleString()}`);
    console.log(`  RPS: ${expressResult.rps.toLocaleString()}`);
    console.log(`  Avg: ${expressResult.avg.toFixed(2)}ms`);
    console.log(`  p50: ${expressResult.p50}ms`);
    console.log(`  p99: ${expressResult.p99}ms\n`);
  }
  
  // Summary
  console.log('='.repeat(60));
  console.log('📊 Summary\n');
  
  for (const result of results) {
    const fastest = Math.max(...results.map((r) => r.rps));
    const ratio = (result.rps / fastest * 100).toFixed(1);
    console.log(`${result.name.padEnd(10)} ${result.rps.toLocaleString().padStart(8)} req/s (${ratio}%)`);
  }
  
  console.log('\n');
}

// ============================================================================
// Run
// ============================================================================

runBenchmarks().catch(console.error);
