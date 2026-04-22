import type { ServraApp } from 'servra';
import { health } from '../controllers/health.controller.js';

export function registerHealthRoutes(app: ServraApp): void {
  app.get('/health', health);
}
