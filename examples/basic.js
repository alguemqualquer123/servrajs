/**
 * LOA Framework - Basic Example
 * 
 * Simple working example showing core features.
 */

const { createApp } = require('../dist/index.js');

const app = createApp({
  dev: true,
  debug: true,
});

// Simple routes
app.get('/', (req, res) => {
  return res.json({
    message: 'Hello from LOA!',
    version: '1.0.0',
  });
});

app.get('/health', (req, res) => {
  return res.json({
    status: 'ok',
    timestamp: Date.now(),
  });
});

// Route with parameters
app.get('/users/:id', (req, res) => {
  const { id } = req.params;
  return res.json({
    id,
    name: `User ${id}`,
    email: `user${id}@example.com`,
  });
});

// Query string example
app.get('/search', (req, res) => {
  const { q, page } = req.query;
  return res.json({
    query: q,
    page: page || '1',
    results: [],
  });
});

// POST example
app.post('/users', (req, res) => {
  // Parse body would need middleware - for now just echo
  return res.status(201).json({
    created: true,
    data: req.body || {},
  });
});

// Error handler
app.setErrorHandler(async (err, req, res) => {
  console.error('Error:', err.message);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
  });
});

// Start server
app.listen(3000, '0.0.0.0').then((server) => {
  const address = server.address();
  console.log(`\n🚀 LOA server running at http://localhost:${address.port}`);
  console.log('\n📖 Try these endpoints:');
  console.log(`   curl http://localhost:${address.port}/`);
  console.log(`   curl http://localhost:${address.port}/health`);
  console.log(`   curl http://localhost:${address.port}/users/123`);
  console.log(`   curl "http://localhost:${address.port}/search?q=test"`);
  console.log(`   curl -X POST http://localhost:${address.port}/users -H "Content-Type: application/json" -d '{"name":"John"}'`);
});