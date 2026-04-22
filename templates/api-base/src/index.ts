import { createApi } from './app.js';
import { env } from './config/env.js';

export const app = createApi();

await app.listen(env.port, env.host);

console.log(`API listening on http://${env.host}:${env.port}`);
