/**
 * Servra - Server-Sent Events (SSE)
 * 
 * Server-Sent Events support for real-time updates.
 */

import type { LOARequest, LOAResponse } from '../core/types';

export interface SSEOptions {
  retry?: number;
  heartbeat?: number;
  heartbeatMessage?: string;
}

export interface SSEResponse extends LOAResponse {
  sse(event?: string, data?: unknown): void;
  sseJSON(event?: string, data?: unknown): void;
  heartbeat(): void;
}

export interface SSEConnection {
  id: string;
  req: LOARequest;
  send(event: string, data: unknown): void;
  sendJSON(event: string, data: unknown): void;
  close(): void;
}

const DEFAULT_RETRY = 5000;
const DEFAULT_HEARTBEAT = 15000;
const DEFAULT_HEARTBEAT_MSG = ':heartbeat';

const connections = new Map<string, SSEConnection>();

let connectionId = 0;

export function createSSE(req: LOARequest, res: LOAResponse, options: SSEOptions = {}): SSEResponse {
  const retry = options.retry ?? DEFAULT_RETRY;
  const heartbeat = options.heartbeat ?? DEFAULT_HEARTBEAT;
  const heartbeatMsg = options.heartbeatMessage ?? DEFAULT_HEARTBEAT_MSG;

  const id = `sse-${++connectionId}`;
  const sseRes = res as unknown as SSEResponse;

  res.header('Content-Type', 'text/event-stream');
  res.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.header('Connection', 'keep-alive');
  res.header('X-Accel-Buffering', 'no');

  if (retry > 0) {
    res.header('Retry-After', retry.toString());
  }

  res.raw.on('close', () => {
    connections.delete(id);
  });

  const sseConnection: SSEConnection = {
    id,
    req,
    send: (event: string, data: unknown) => {
      const formatted = formatSSE(event, data);
      res.raw.write(formatted);
    },
    sendJSON: (event: string, data: unknown) => {
      const formatted = formatSSE(event, JSON.stringify(data));
      res.raw.write(formatted);
    },
    close: () => {
      res.raw.end();
    },
  };

  connections.set(id, sseConnection);

  if (heartbeat > 0) {
    const interval = setInterval(() => {
      if (!res.raw.writableEnded) {
        res.raw.write(formatSSE('', heartbeatMsg));
      } else {
        clearInterval(interval);
      }
    }, heartbeat);
  }

  const originalJson = res.json.bind(res);
  res.json = function(data: unknown): LOAResponse {
    sseRes.sseJSON('message', data);
    return res;
  };

  sseRes.sse = (event?: string, data?: unknown) => {
    sseConnection.send(event || '', data);
  };

  sseRes.sseJSON = (event?: string, data?: unknown) => {
    sseConnection.sendJSON(event || '', data);
  };

  sseRes.heartbeat = () => {
    sseConnection.send('', heartbeatMsg);
  };

  res.status(200).send();

  return sseRes;
}

function formatSSE(event: string, data: unknown): string {
  const lines: string[] = [];

  if (event) {
    lines.push(`event: ${event}`);
  }

  const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
  dataStr.split('\n').forEach(line => {
    lines.push(`data: ${line}`);
  });

  lines.push('');
  return lines.join('\n');
}

export function broadcast(event: string, data: unknown): void {
  connections.forEach(conn => {
    conn.send(event, data);
  });
}

export function broadcastJSON(event: string, data: unknown): void {
  connections.forEach(conn => {
    conn.sendJSON(event, data);
  });
}

export function getConnectionCount(): number {
  return connections.size;
}

export function getConnections(): SSEConnection[] {
  return Array.from(connections.values());
}

export default {
  createSSE,
  broadcast,
  broadcastJSON,
  getConnectionCount,
  getConnections,
};
