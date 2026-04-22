import type { LOAApp } from '__PACKAGE_NAME__';
import { health } from '../controllers/health.controller.js';

export function registerHealthRoutes(app: LOAApp): void {
  app.get('/health', health);
}
