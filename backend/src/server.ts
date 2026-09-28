import { buildApp } from './app';
import { env } from './config/env';

const start = async () => {
  const app = buildApp();
  
  try {
    await app.listen({ port: env.PORT, host: env.HOST });
    app.log.info(`Server listening on ${env.HOST}:${env.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
