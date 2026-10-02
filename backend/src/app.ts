import Fastify, { FastifyInstance } from 'fastify';
import healthRoutes from './routes/health';
import simulatorRoutes from './routes/simulator';
import prisma from './db/prisma';

import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import adminRoutes from './routes/admin';
import { whatsappRoutes } from './routes/whatsapp';
import { isWhatsappConfigured } from './config/env';
import { createWhatsAppProvider } from './whatsapp/providers';
import { whatsappDeliveryService } from './services/whatsappDeliveryService';

export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger: true,
    ajv: {
      customOptions: {
        removeAdditional: false
      }
    }
  });

  app.register(cors, {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
    credentials: true,
  });

  app.register(cookie);
  app.register(rateLimit, { global: false });

  app.register(healthRoutes);
  if (process.env.NODE_ENV !== 'production') {
    app.register(simulatorRoutes);
  }
  app.register(adminRoutes);

  if (isWhatsappConfigured()) {
    app.register(whatsappRoutes);
    app.addHook('onReady', async () => {
      whatsappDeliveryService.start(createWhatsAppProvider());
    });
    app.log.info('WhatsApp integration enabled');
  } else {
    app.log.warn('WhatsApp integration disabled: missing env vars');
  }

  app.addHook('onClose', async () => {
    await whatsappDeliveryService.stop();
    await prisma.$disconnect();
  });

  return app;
}
