import Fastify, { FastifyInstance } from 'fastify';
import healthRoutes from './routes/health';
import simulatorRoutes from './routes/simulator';
import prisma from './db/prisma';

import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import adminRoutes from './routes/admin';

export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger: true,
  });

  app.register(cors, {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
    credentials: true,
  });

  app.register(cookie);

  app.register(healthRoutes);
  app.register(simulatorRoutes);
  app.register(adminRoutes);

  app.addHook('onClose', async () => {
    await prisma.$disconnect();
  });

  return app;
}
