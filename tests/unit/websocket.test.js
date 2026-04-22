import { createWebSocket } from '../../dist/protocols/websocket.js';
import { createServer } from 'node:http';

await test('WebSocket manager has default path and can mount', async () => {
  const server = createServer((req, res) => {
    res.writeHead(200);
    res.end('ok');
  });
  const manager = createWebSocket();
  manager.mount(server);
  if (manager.connections !== 0) throw new Error('initial connections not zero');
  server.listen(0);
  // Close immediately
  server.close();
});
