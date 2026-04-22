import type { LOAApp } from '@srvinix/loa';
import { registerHealthRoutes } from './health.routes.js';
import { registerUserRoutes } from './user.routes.js';

export function registerRoutes(app: LOAApp): void {
  registerHealthRoutes(app);
  registerUserRoutes(app);
}
