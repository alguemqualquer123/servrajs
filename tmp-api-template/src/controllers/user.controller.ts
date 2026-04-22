import type { LOARequest, LOAResponse } from '@srvinix/loa';
import { createUser, getUser, listUsers } from '../services/user.service.js';
import { created, ok } from '../utils/response.js';

export function index(req: LOARequest, res: LOAResponse) {
  return ok(res, {
    name: 'tmp-api-template',
    version: '1.0.0',
    routes: ['/health', '/api/v1/users'],
  });
}

export function list(req: LOARequest, res: LOAResponse) {
  return ok(res, listUsers());
}

export function show(req: LOARequest, res: LOAResponse) {
  return ok(res, getUser(req.param('id')));
}

export function create(req: LOARequest, res: LOAResponse) {
  return created(res, createUser(req.body));
}
