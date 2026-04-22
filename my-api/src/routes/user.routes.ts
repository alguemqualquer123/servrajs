import type { ServraApp } from 'servrajs';
import * as users from '../controllers/user.controller.js';

export function registerUserRoutes(app: ServraApp): void {
  app.get('/api/v1', users.index);
  app.get('/api/v1/users', users.list);
  app.get('/api/v1/users/:id', users.show);
  app.post('/api/v1/users', users.create);
}
