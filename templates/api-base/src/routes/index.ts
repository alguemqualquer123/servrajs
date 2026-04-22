import type { LOAApp } from '__PACKAGE_NAME__';
import { registerHealthRoutes } from './health.routes.js';
import { registerUserRoutes } from './user.routes.js';

export function registerRoutes(app: LOAApp): void {
  registerHealthRoutes(app);
  registerUserRoutes(app);
}
