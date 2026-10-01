import { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { env, isWhatsappProviderConfigured } from '../config/env';
import { WebhookPayload } from '../whatsapp/types';
import { createWhatsAppProvider } from '../whatsapp/providers';
import { conversationService } from '../services/conversationService';
import prisma from '../db/prisma';

export const whatsappRoutes: FastifyPluginAsync = async (server) => {
  const metaProvider = createWhatsAppProvider('meta');
  const evolutionProvider = createWhatsAppProvider('evolution');
  const outboundProvider = createWhatsAppProvider(env.WHATSAPP_PROVIDER);

  // Add a route-scoped content type parser for application/json that parses as buffer
  // This ensures we get the raw Buffer for signature verification before any JSON parsing.
  server.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (_req: FastifyRequest, body: Buffer, done: (err: Error | null, body?: any) => void) => {
      // Pass the raw Buffer through directly as request.body
      done(null, body);
    }
  );

  if (isWhatsappProviderConfigured('meta')) {
    server.get('/webhook/whatsapp', async (request, reply) => {
    const query = request.query as any;
    
    if (metaProvider.verifyInboundChallenge(
      query['hub.mode'],
      query['hub.verify_token']
    )) {
      // Return the challenge plain text with HTTP 200
      return reply.status(200).send(query['hub.challenge']);
    }
    
    // Invalid verification
    return reply.status(403).send();
    });

    server.post('/webhook/whatsapp', async (request, reply) => {
    const rawBody = request.body as Buffer;
    const signature = request.headers['x-hub-signature-256'] as string;

    if (!env.META_APP_SECRET) {
      server.log.error('META_APP_SECRET is not configured');
      return reply.status(500).send();
    }

    if (!metaProvider.verifyInboundSignature(rawBody, signature)) {
      server.log.warn('Invalid or missing WhatsApp webhook signature');
      return reply.status(401).send();
    }

    let payload: WebhookPayload;
    try {
      payload = JSON.parse(rawBody.toString('utf-8'));
    } catch (err) {
      server.log.error('Malformed JSON in WhatsApp webhook payload');
      return reply.status(400).send();
    }

    // Acknowledge receipt to Meta immediately
    reply.status(200).send();

    // Process asynchronously (fire-and-forget)
    processWebhookPayload('meta', metaProvider, payload).catch((err) => {
      server.log.error({ err: err instanceof Error ? err.message : String(err) }, 'Error processing WhatsApp webhook payload');
    });

    return reply;
    });
  }

  if (isWhatsappProviderConfigured('evolution')) {
    server.post('/webhook/evolution', async (request, reply) => {
      const secret = request.headers['x-evolution-webhook-secret'] as string | undefined;
      if (!evolutionProvider.verifyWebhookSecret(secret)) {
        server.log.warn('Invalid or missing Evolution webhook authentication');
        return reply.status(401).send();
      }

      const rawBody = request.body as Buffer;
      let payload: unknown;
      try {
        payload = JSON.parse(rawBody.toString('utf-8'));
      } catch (_err) {
        return reply.status(400).send();
      }

      reply.status(200).send();
      processWebhookPayload('evolution', evolutionProvider, payload).catch((err) => {
        server.log.error({ err: err instanceof Error ? err.message : String(err) }, 'Error processing Evolution webhook payload');
      });
      return reply;
    });
  }

  async function processWebhookPayload(
    provider: 'meta' | 'evolution',
    inboundProvider: ReturnType<typeof createWhatsAppProvider>,
    payload: WebhookPayload | unknown
  ) {
    const events = inboundProvider.parseInbound(payload);
    server.log.info(
      {
        provider,
        eventCount: events.length,
        eventTypes: [...new Set(events.map((event) => event.type))]
      },
      'Parsed WhatsApp webhook events'
    );

    for (const event of events) {
      if (event.type === 'text') {
        await handleIncomingMessage(event.waId, event.messageId, event.text);
      } else if (event.type === 'unsupported') {
        await handleUnsupportedMessage(event.waId, event.messageId);
      }
      // Statuses, reactions, and ignored events are silently skipped as per the plan
    }
  }

  async function handleIncomingMessage(waId: string, messageId: string, text: string) {
    try {
      // Attempt idempotency deduplication
      await prisma.processedWhatsappMessage.create({
        data: {
          messageId,
          waId
        }
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        // Duplicate messageId, skip silently
        return;
      }
      // Re-throw other errors (e.g. DB connection issues) so they can be logged
      throw error;
    }

    // Hand over to the ConversationService
    const responseText = await conversationService.handleMessage('whatsapp', waId, text);
    if (responseText) {
      await outboundProvider.sendTextMessage(waId, responseText);
    }
  }

  async function handleUnsupportedMessage(waId: string, messageId: string) {
    try {
      // Attempt idempotency deduplication
      await prisma.processedWhatsappMessage.create({
        data: {
          messageId,
          waId
        }
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        return;
      }
      throw error;
    }

    // Send the polite unsupported text reply
    await outboundProvider.sendTextMessage(waId, env.WHATSAPP_REPLY_UNSUPPORTED);
  }
};
