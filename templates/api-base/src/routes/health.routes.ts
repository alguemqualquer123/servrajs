import type { ServraApp } from '__PACKAGE_NAME__';
import { health } from '../controllers/health.controller.js';

export function registerHealthRoutes(app: ServraApp): void {
  app.get('/health', health);
}
