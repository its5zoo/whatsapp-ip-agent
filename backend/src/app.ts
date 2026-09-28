import Fastify, { FastifyInstance } from 'fastify';
import healthRoutes from './routes/health';
import prisma from './db/prisma';

export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger: true,
  });

  app.register(healthRoutes);

  app.addHook('onClose', async () => {
    await prisma.$disconnect();
  });

  return app;
}
