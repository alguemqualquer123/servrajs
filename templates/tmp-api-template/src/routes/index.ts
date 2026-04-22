import type { ServraApp } from 'servra';
import { registerHealthRoutes } from './health.routes.js';
import { registerUserRoutes } from './user.routes.js';

export function registerRoutes(app: ServraApp): void {
  registerHealthRoutes(app);
  registerUserRoutes(app);
}
