import { createApi,  } from './app.js';
import { env } from './config/env.js';

export const app = createApi();

await app.listen(env.port, env.host).then(() => {
  console.log(`API listening on http://${env.host}:${env.port}`);
});


app.get('/health', (req: any, res: any) => {
  res.send({ status: 'ok' });
});