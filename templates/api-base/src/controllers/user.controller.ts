import type { ServraRequest, ServraResponse } from '__PACKAGE_NAME__';
import { createUser, getUser, listUsers } from '../services/user.service.js';
import { created, ok } from '../utils/response.js';

export function index(req: ServraRequest, res: ServraResponse) {
  return ok(res, {
    name: '__PROJECT_NAME__',
    version: '1.0.0',
    routes: ['/health', '/api/v1/users'],
  });
}

export function list(req: ServraRequest, res: ServraResponse) {
  return ok(res, listUsers());
}

export function show(req: ServraRequest, res: ServraResponse) {
  return ok(res, getUser(req.param('id')));
}

export function create(req: ServraRequest, res: ServraResponse) {
  return created(res, createUser(req.body));
}
