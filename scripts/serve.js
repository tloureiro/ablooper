import { createAppServer } from './server.js';

const port = Number(process.env.PORT ?? 3000);
const server = createAppServer();
server.listen(port, '127.0.0.1', () => {
  console.log(`AB Looper → http://127.0.0.1:${server.address().port}`);
});
