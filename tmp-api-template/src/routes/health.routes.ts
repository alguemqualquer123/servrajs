import type { LOAApp } from '@srvinix/loa';
import { health } from '../controllers/health.controller.js';

export function registerHealthRoutes(app: LOAApp): void {
  app.get('/health', health);
}
