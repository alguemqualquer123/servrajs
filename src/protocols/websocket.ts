/**
 * Servra - WebSocket Support
 * 
 * Native WebSocket support based on ws library.
 */

import { WebSocketServer, WebSocket, RawData } from 'ws';
import type { Server as HttpServer } from 'http';
import type { Middleware, LOARequest, LOAResponse } from '../core/types';

export interface WebSocketOptions {
  path?: string;
  pingInterval?: number;
  pingTimeout?: number;
  maxPayload?: number;
  perMessageDeflate?: boolean | {
    serverNoContextTakeover?: boolean;
    clientNoContextTakeover?: boolean;
    serverMaxWindowBits?: number;
    clientMaxWindowBits?: number;
    zlibCryptoSync?: boolean;
  };
  verifyClient?: (req: LOARequest) => boolean | { code: number; message?: string };
}

export interface WebSocketMessage {
  type: string;
  data: unknown;
}

export interface WebSocketConnection {
  socket: WebSocket;
  req: LOARequest;
  send(data: unknown): void;
  sendJSON(data: unknown): void;
  ping(): void;
  close(code?: number, reason?: string): void;
  isAlive: boolean;
}

export type WebSocketHandler = (conn: WebSocketConnection) => void;
export type WebSocketMessageHandler = (conn: WebSocketConnection, message: string, isBinary: boolean) => void;

const DEFAULT_PING_INTERVAL = 30000;
const DEFAULT_PING_TIMEOUT = 5000;

export class WebSocketManager {
  #server: WebSocketServer | null = null;
  #options: Required<WebSocketOptions>;
  #connections: Set<WebSocketConnection> = new Set();
  #handlers: Map<string, WebSocketMessageHandler> = new Map();
  #onConnect: WebSocketHandler | null = null;
  #onDisconnect: WebSocketHandler | null = null;
  #pingInterval: ReturnType<typeof setInterval> | null = null;

  constructor(options: WebSocketOptions = {}) {
    this.#options = {
      path: options.path ?? '/ws',
      pingInterval: options.pingInterval ?? DEFAULT_PING_INTERVAL,
      pingTimeout: options.pingTimeout ?? DEFAULT_PING_TIMEOUT,
      maxPayload: options.maxPayload ?? 16 * 1024 * 1024,
      perMessageDeflate: options.perMessageDeflate ?? false,
      verifyClient: options.verifyClient ?? (() => true),
    };
  }

  mount(httpServer: HttpServer): void {
    this.#server = new WebSocketServer({
      server: httpServer,
      path: this.#options.path,
      maxPayload: this.#options.maxPayload,
      perMessageDeflate: this.#options.perMessageDeflate as WebSocketOptions['perMessageDeflate'],
    });

    this.#server.on('connection', (socket: WebSocket, req: Request) => {
      this.#handleConnection(socket, req as unknown as LOARequest);
    });

    this.#server.on('error', (error: Error) => {
      console.error('[WS] Server error:', error);
    });

    this.#pingInterval = setInterval(() => {
      this.#pingConnections();
    }, this.#options.pingInterval);
  }

  onConnect(handler: WebSocketHandler): this {
    this.#onConnect = handler;
    return this;
  }

  onDisconnect(handler: WebSocketHandler): this {
    this.#onDisconnect = handler;
    return this;
  }

  onMessage(type: string, handler: WebSocketMessageHandler): this {
    this.#handlers.set(type, handler);
    return this;
  }

  broadcast(type: string, data: unknown): void {
    const message = JSON.stringify({ type, data });
    this.#connections.forEach(conn => {
      if (conn.isAlive) {
        conn.socket.send(message);
      }
    });
  }

  broadcastJSON(data: unknown): void {
    this.#connections.forEach(conn => {
      if (conn.isAlive) {
        conn.sendJSON(data);
      }
    });
  }

  #handleConnection(socket: WebSocket, req: LOARequest): void {
    const verifyResult = this.#options.verifyClient(req);
    if (verifyResult !== true) {
      if (typeof verifyResult === 'object') {
        socket.close(verifyResult.code, verifyResult.message);
      } else {
        socket.close(4001, 'Unauthorized');
      }
      return;
    }

    const conn: WebSocketConnection = {
      socket,
      req,
      isAlive: true,
      send: (data: unknown) => {
        socket.send(typeof data === 'string' ? data : JSON.stringify(data));
      },
      sendJSON: (data: unknown) => {
        socket.send(JSON.stringify(data));
      },
      ping: () => {
        socket.ping();
      },
      close: (code?: number, reason?: string) => {
        socket.close(code, reason);
      },
    };

    this.#connections.add(conn);

    socket.on('message', (data: RawData, isBinary: boolean) => {
      if (isBinary) {
        return;
      }

      try {
        const message = JSON.parse(data.toString()) as WebSocketMessage;
        const handler = this.#handlers.get(message.type);
        if (handler) {
          handler(conn, message.data as string, false);
        }
      } catch {
        // Ignore invalid JSON
      }
    });

    socket.on('close', () => {
      this.#connections.delete(conn);
      if (this.#onDisconnect) {
        this.#onDisconnect(conn);
      }
    });

    socket.on('error', (error: Error) => {
      console.error('[WS] Connection error:', error);
    });

    socket.on('pong', () => {
      conn.isAlive = true;
    });

    if (this.#onConnect) {
      this.#onConnect(conn);
    }
  }

  #pingConnections(): void {
    const deadConnections: WebSocketConnection[] = [];

    this.#connections.forEach(conn => {
      if (!conn.isAlive) {
        deadConnections.push(conn);
        return;
      }

      conn.isAlive = false;
      conn.socket.ping();
    });

    deadConnections.forEach(conn => {
      conn.socket.terminate();
      this.#connections.delete(conn);
    });
  }

  get connections(): number {
    return this.#connections.size;
  }

  close(): void {
    if (this.#pingInterval) {
      clearInterval(this.#pingInterval);
    }

    this.#connections.forEach(conn => {
      conn.socket.close(1001, 'Server shutting down');
    });

    if (this.#server) {
      this.#server.close();
      this.#server = null;
    }
  }
}

export function createWebSocket(options?: WebSocketOptions): WebSocketManager {
  return new WebSocketManager(options);
}

export default { createWebSocket, WebSocketManager };
