/**
 * Servra - Graceful Shutdown
 * 
 * Graceful server shutdown with connection draining.
 */

import type { Server } from 'http';

export interface GracefulShutdownOptions {
  forceTimeout?: number;
  onShutdown?: () => Promise<void>;
  signals?: NodeJS.Signals[];
}

const DEFAULT_FORCE_TIMEOUT = 10000;
const DEFAULT_SIGNALS: NodeJS.Signals[] = ['SIGTERM', 'SIGINT', 'SIGQUIT'];

export function setupGracefulShutdown(
  server: Server,
  options: GracefulShutdownOptions = {}
): void {
  const forceTimeout = options.forceTimeout ?? DEFAULT_FORCE_TIMEOUT;
  const signals = options.signals ?? DEFAULT_SIGNALS;

  const shutdown = (signal: string): void => {
    console.log(`[SHUTDOWN] Received ${signal}, starting graceful shutdown...`);
    console.log('[SHUTDOWN] Stopping new connections...');

    server.close((err) => {
      if (err) {
        console.error('[SHUTDOWN] Error during shutdown:', err);
        process.exit(1);
      }

      console.log('[SHUTDOWN] All connections closed');

      if (options.onShutdown) {
        options.onShutdown().then(() => {
          console.log('[SHUTDOWN] Cleanup complete');
          process.exit(0);
        }).catch((e) => {
          console.error('[SHUTDOWN] Cleanup error:', e);
          process.exit(1);
        });
      } else {
        console.log('[SHUTDOWN] Cleanup complete');
        process.exit(0);
      }
    });

    let didForce = false;
    setTimeout(() => {
      if (!didForce) {
        didForce = true;
        console.log('[SHUTDOWN] Force closing after timeout...');
        server.closeAllConnections();
        process.exit(1);
      }
    }, forceTimeout).unref();
  };

  signals.forEach(signal => {
    process.on(signal, () => shutdown(signal));
  });

  process.on('uncaughtException', (err) => {
    console.error('[SHUTDOWN] Uncaught exception:', err);
    server.closeAllConnections();
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    console.error('[SHUTDOWN] Unhandled rejection:', reason);
  });
}

export default setupGracefulShutdown;
