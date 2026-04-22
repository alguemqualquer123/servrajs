/**
 * LOA Framework - Advanced TypeScript Example
 * 
 * Example with full TypeScript types, validation, middleware, and grouping.
 */

import { createApp } from '../src/index.js';
import type { Handler, LOARequest, LOAResponse } from '../src/index.js';
import { validator } from '../src/validation/index.js';

const app = createApp({
  dev: true,
  debug: true,
});

// ============================================================================
// Middleware
// ============================================================================

// Request logger middleware
const requestLogger: Handler = async (req, res, next) => {
  const start = Date.now();
  console.log(`[REQUEST] ${req.method} ${req.path}`);
  
  await next();
  
  const duration = Date.now() - start;
  console.log(`[RESPONSE] ${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
};

// Authentication middleware (example)
const authMiddleware = async (req: LOARequest, res: LOAResponse, next: () => Promise<void>) => {
  const token = req.header('authorization');
  
  if (!token) {
    res.status(401).json({ error: 'Unauthorized', message: 'Missing token' });
    return;
  }
  
  // In real app, validate token
  await next();
};

// ============================================================================
// Validation Schemas
// ============================================================================

const userSchema = {
  name: { type: 'string', required: true, min: 2, max: 50 },
  email: { type: 'string', required: true },
  age: { type: 'number', required: false, min: 18, max: 150 },
};

// Create user schema
const createUserSchema = {
  name: { type: 'string', required: true, min: 2, max: 50 },
  email: { type: 'string', required: true },
  password: { type: 'string', required: true, min: 8 },
};

// ============================================================================
// Global Middleware
// ============================================================================

app.use(requestLogger);

// ============================================================================
// Routes
// ============================================================================

// Health check - no auth needed
app.get('/health', (req, res) => {
  return res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Public routes
app.get('/', (req, res) => {
  return res.json({
    message: 'Welcome to LOA API',
    version: '1.0.0',
    docs: '/docs',
  });
});

// Grouped routes with prefix
app.group('/api/v1', () => {
  // User routes
  app.get('/users', (req, res) => {
    const users = [
      { id: '1', name: 'John Doe', email: 'john@example.com' },
      { id: '2', name: 'Jane Doe', email: 'jane@example.com' },
    ];
    return res.json(users);
  });
  
  app.get('/users/:id', (req, res) => {
    const { id } = req.params;
    return res.json({
      id,
      name: `User ${id}`,
      email: `user${id}@example.com`,
    });
  });
  
  // Protected route - needs auth
  app.post('/users', authMiddleware, validator(createUserSchema), async (req, res) => {
    const body = req.body;
    
    // Create user
    const user = {
      id: Math.random().toString(36).slice(2),
      ...body,
      createdAt: new Date().toISOString(),
    };
    
    return res.status(201).json(user);
  });
  
  app.put('/users/:id', authMiddleware, (req, res) => {
    const { id } = req.params;
    const body = req.body;
    
    return res.json({
      id,
      ...body,
      updatedAt: new Date().toISOString(),
    });
  });
  
  app.delete('/users/:id', authMiddleware, (req, res) => {
    const { id } = req.params;
    
    return res.json({
      deleted: true,
      id,
    });
  });
  
  // Posts
  app.get('/posts', (req, res) => {
    const posts = [
      { id: '1', title: 'First Post', author: '1' },
      { id: '2', title: 'Second Post', author: '2' },
    ];
    return res.json(posts);
  });
  
  app.get('/posts/:id', (req, res) => {
    const { id } = req.params;
    
    return res.json({
      id,
      title: `Post ${id}`,
      content: 'Content here...',
      author: '1',
      createdAt: new Date().toISOString(),
    });
  });
});

// Error handler
app.setErrorHandler(async (err, req, res, next) => {
  console.error('[ERROR]', err.message);
  
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' 
      ? 'An error occurred' 
      : err.message,
    statusCode: 500,
  });
});

// ============================================================================
// Start Server
// ============================================================================

const PORT = parseInt(process.env.PORT || '3000', 10);

app.listen(PORT, '0.0.0.0').then(() => {
  console.log(`\n🚀 LOA API server running at http://localhost:${PORT}`);
  console.log(`\n📖 API Endpoints:`);
  console.log(`   GET  /health              - Health check`);
  console.log(`   GET  /                   - Welcome`);
  console.log(`   GET  /api/v1/users       - List users`);
  console.log(`   GET  /api/v1/users/:id   - Get user`);
  console.log(`   POST /api/v1/users       - Create user (needs auth)`);
  console.log(`   PUT  /api/v1/users/:id   - Update user (needs auth)`);
  console.log(`   DELETE /api/v1/users/:id - Delete user (needs auth)`);
  console.log(`   GET  /api/v1/posts       - List posts`);
  console.log(`   GET  /api/v1/posts/:id  - Get post`);
});