import Fastify, { FastifyInstance } from 'fastify';
import healthRoutes from './routes/health';
import simulatorRoutes from './routes/simulator';
import prisma from './db/prisma';

export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger: true,
  });

  app.register(healthRoutes);
  app.register(simulatorRoutes);

  app.addHook('onClose', async () => {
    await prisma.$disconnect();
  });

  return app;
}
