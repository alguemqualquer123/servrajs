import { badRequest, notFound } from '../utils/http-error.js';

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface CreateUserInput {
  name: string;
  email: string;
}

const users = new Map<string, User>();

seed();

export function listUsers(): User[] {
  return [...users.values()];
}

export function getUser(id: string): User {
  const user = users.get(id);
  if (!user) {
    throw notFound('User not found');
  }
  return user;
}

export function createUser(input: unknown): User {
  const data = parseCreateUserInput(input);
  const emailTaken = [...users.values()].some((user) => user.email === data.email);

  if (emailTaken) {
    throw badRequest('Email already exists');
  }

  const user: User = {
    id: crypto.randomUUID(),
    name: data.name,
    email: data.email,
    createdAt: new Date().toISOString(),
  };

  users.set(user.id, user);
  return user;
}

function parseCreateUserInput(input: unknown): CreateUserInput {
  if (!input || typeof input !== 'object') {
    throw badRequest('JSON body is required');
  }

  const candidate = input as Partial<CreateUserInput>;
  const name = typeof candidate.name === 'string' ? candidate.name.trim() : '';
  const email = typeof candidate.email === 'string' ? candidate.email.trim().toLowerCase() : '';

  if (name.length < 2) {
    throw badRequest('Name must have at least 2 characters');
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw badRequest('Email must be valid');
  }

  return { name, email };
}

function seed(): void {
  const now = new Date().toISOString();
  const initialUsers: User[] = [
    {
      id: 'usr_1',
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      createdAt: now,
    },
    {
      id: 'usr_2',
      name: 'Grace Hopper',
      email: 'grace@example.com',
      createdAt: now,
    },
  ];

  for (const user of initialUsers) {
    users.set(user.id, user);
  }
}
