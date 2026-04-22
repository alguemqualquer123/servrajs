import type { LOAApp } from '@srvinix/loa';
import * as users from '../controllers/user.controller.js';

export function registerUserRoutes(app: LOAApp): void {
  app.get('/api/v1', users.index);
  app.get('/api/v1/users', users.list);
  app.get('/api/v1/users/:id', users.show);
  app.post('/api/v1/users', users.create);
}
