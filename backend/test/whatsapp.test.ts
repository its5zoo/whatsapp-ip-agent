import { test, describe, before, beforeEach, afterEach, after, mock } from 'node:test';
import * as assert from 'node:assert';
import { buildApp } from '../src/app';
import { FastifyInstance } from 'fastify';
import { env } from '../src/config/env';
import crypto from 'node:crypto';
import { conversationService } from '../src/services/conversationService';
import { whatsappClient } from '../src/services/whatsappClient';
import prisma from '../src/db/prisma';
import { whatsappDeliveryService } from '../src/services/whatsappDeliveryService';
import { waitFor } from './testUtils';

describe('whatsappRoutes', () => {
  let app: FastifyInstance;
  let originalEnv: typeof env;

  before(async () => {
    originalEnv = { ...env };
    env.WHATSAPP_PHONE_NUMBER_ID = 'test-phone-id';
    env.WHATSAPP_ACCESS_TOKEN = 'test-token';
    env.WHATSAPP_VERIFY_TOKEN = 'test-verify';
    env.META_APP_SECRET = 'test-secret';
    env.WHATSAPP_GRAPH_API_VERSION = 'v22.0';
    env.EVOLUTION_API_URL = 'https://evolution.example.com';
    env.EVOLUTION_API_KEY = 'evolution-api-key';
    env.EVOLUTION_INSTANCE = 'test-instance';
    env.EVOLUTION_WEBHOOK_SECRET = 'evolution-webhook-secret';

    app = buildApp();
    await app.ready();
  });

  beforeEach(async () => {
    await prisma.processedWhatsappMessage.deleteMany({});
    await prisma.whatsappOutboundMessage.deleteMany({});
    await prisma.lead.deleteMany({});
    await prisma.conversation.deleteMany({});
    mock.method(conversationService as any, 'handleMessageInTransaction', async () => ({
      response: 'mock response',
      notifications: []
    }));
    mock.method(whatsappClient, 'sendTextMessage', async () => ({ outcome: 'accepted' }));
    mock.method(app.log, 'error', () => {});
    mock.method(app.log, 'info', () => {});
    mock.method(app.log, 'warn', () => {});
  });

  afterEach(() => {
    mock.restoreAll();
  });

  after(async () => {
    Object.assign(env, originalEnv);
    await app.close();
  });

  function signPayload(payloadString: string, secret: string = 'test-secret'): string {
    const hash = crypto.createHmac('sha256', secret).update(Buffer.from(payloadString)).digest('hex');
    return `sha256=${hash}`;
  }

  describe('GET /webhook/whatsapp', () => {
    test('should return 200 and challenge for valid token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/webhook/whatsapp',
        query: {
          'hub.mode': 'subscribe',
          'hub.verify_token': 'test-verify',
          'hub.challenge': '123456789'
        }
      });
      assert.strictEqual(response.statusCode, 200);
      assert.strictEqual(response.body, '123456789');
    });

    test('should return 403 for invalid token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/webhook/whatsapp',
        query: {
          'hub.mode': 'subscribe',
          'hub.verify_token': 'wrong-token',
          'hub.challenge': '123456789'
        }
      });
      assert.strictEqual(response.statusCode, 403);
    });

    test('should return 403 for missing token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/webhook/whatsapp',
        query: {
          'hub.mode': 'subscribe',
          'hub.challenge': '123456789'
        }
      });
      assert.strictEqual(response.statusCode, 403);
    });
  });

  describe('POST /webhook/whatsapp', () => {
    test('should return 401 for missing signature', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/webhook/whatsapp',
        payload: { test: 'data' }
      });
      assert.strictEqual(response.statusCode, 401);
    });

    test('should return 401 for invalid signature', async () => {
      const payloadString = '{"test":"data"}';
      const response = await app.inject({
        method: 'POST',
        url: '/webhook/whatsapp',
        headers: {
          'content-type': 'application/json',
          'x-hub-signature-256': signPayload(payloadString, 'wrong-secret')
        },
        payload: payloadString
      });
      assert.strictEqual(response.statusCode, 401);
    });

    test('should return 400 for malformed JSON with valid signature', async () => {
      const malformedPayload = '{"test": "data"';
      const response = await app.inject({
        method: 'POST',
        url: '/webhook/whatsapp',
        headers: {
          'content-type': 'application/json',
          'x-hub-signature-256': signPayload(malformedPayload)
        },
        payload: malformedPayload
      });
      assert.strictEqual(response.statusCode, 400);
    });

    test('should return 200 and process valid text message', async () => {
      const payload = {
        object: 'whatsapp_business_account',
        entry: [{
          id: '123',
          changes: [{
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: { display_phone_number: '1', phone_number_id: '2' },
              contacts: [{ profile: { name: 'Test' }, wa_id: '123456' }],
              messages: [{ from: '123456', id: 'wamid.test1', timestamp: '123', type: 'text', text: { body: 'hello' } }]
            }
          }]
        }]
      };
      
      const payloadString = JSON.stringify(payload);
      const response = await app.inject({
        method: 'POST',
        url: '/webhook/whatsapp',
        headers: {
          'content-type': 'application/json',
          'x-hub-signature-256': signPayload(payloadString)
        },
        payload: payloadString
      });

      assert.strictEqual(response.statusCode, 200);

      await waitFor(async () => {
        const dedup = await prisma.processedWhatsappMessage.findUnique({
          where: { messageId: 'wamid.test1' }
        });
        const calls = (whatsappClient.sendTextMessage as any).mock.calls;
        return dedup !== null && calls.length === 1;
      });

      // Verify db insertion
      const dedup = await prisma.processedWhatsappMessage.findUnique({ where: { messageId: 'wamid.test1' }});
      assert.ok(dedup !== null);
      assert.strictEqual(dedup?.waId, '123456');

      const handleMessageCalls = (conversationService as any).handleMessageInTransaction.mock.calls;
      assert.strictEqual(handleMessageCalls.length, 1);
      assert.deepStrictEqual(handleMessageCalls[0].arguments.slice(0, 3), ['whatsapp', '123456', 'hello']);
      
      const sendTextMessageCalls = (whatsappClient.sendTextMessage as any).mock.calls;
      assert.strictEqual(sendTextMessageCalls.length, 1);
      assert.deepStrictEqual(sendTextMessageCalls[0].arguments, ['123456', 'mock response']);
    });

    test('logs only non-sensitive event metadata', async () => {
      const payload = {
        object: 'whatsapp_business_account',
        entry: [{
          id: 'sensitive-entry-id',
          changes: [{
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: { display_phone_number: 'sensitive-phone', phone_number_id: 'sensitive-phone-id' },
              contacts: [{ profile: { name: 'Sensitive Name' }, wa_id: '15550001111' }],
              messages: [{
                from: '15550001111',
                id: 'sensitive-message-id',
                timestamp: '123',
                type: 'text',
                text: { body: 'Sensitive message text' }
              }]
            }
          }]
        }]
      };
      const payloadString = JSON.stringify(payload);

      const response = await app.inject({
        method: 'POST',
        url: '/webhook/whatsapp',
        headers: {
          'content-type': 'application/json',
          'x-hub-signature-256': signPayload(payloadString)
        },
        payload: payloadString
      });

      assert.strictEqual(response.statusCode, 200);
      await new Promise(resolve => setTimeout(resolve, 50));

      const infoCalls = (app.log.info as any).mock.calls;
      const parsedEventsLog = infoCalls.find((call: any[]) => call.arguments[1] === 'Parsed WhatsApp webhook events');
      assert.ok(parsedEventsLog);
      assert.deepStrictEqual(parsedEventsLog.arguments[0], {
        provider: 'meta',
        eventCount: 1,
        eventTypes: ['text']
      });
      const serializedLog = JSON.stringify(parsedEventsLog);
      assert.ok(!serializedLog.includes('Sensitive'));
      assert.ok(!serializedLog.includes('15550001111'));
      assert.ok(!serializedLog.includes('sensitive-message-id'));
    });

    test('should handle duplicate wamid safely', async () => {
      const payload = {
        object: 'whatsapp_business_account',
        entry: [{
          id: '123',
          changes: [{
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: { display_phone_number: '1', phone_number_id: '2' },
              contacts: [{ profile: { name: 'Test' }, wa_id: '123456' }],
              messages: [{ from: '123456', id: 'wamid.test2', timestamp: '123', type: 'text', text: { body: 'hello' } }]
            }
          }]
        }]
      };
      
      const payloadString = JSON.stringify(payload);

      // Pre-insert duplicate
      await prisma.processedWhatsappMessage.create({
        data: { messageId: 'wamid.test2', waId: '123456' }
      });

      const response = await app.inject({
        method: 'POST',
        url: '/webhook/whatsapp',
        headers: {
          'content-type': 'application/json',
          'x-hub-signature-256': signPayload(payloadString)
        },
        payload: payloadString
      });

      assert.strictEqual(response.statusCode, 200);

      await new Promise(resolve => setTimeout(resolve, 50));
      const handleMessageCalls = (conversationService as any).handleMessageInTransaction.mock.calls;
      assert.strictEqual(handleMessageCalls.length, 0);
    });

    test('rolls back message deduplication when processing fails', async () => {
      let attempts = 0;
      mock.restoreAll();
      mock.method(conversationService as any, 'handleMessageInTransaction', async () => {
        attempts += 1;
        if (attempts === 1) {
          throw new Error('temporary processing failure');
        }
        return { response: 'mock response', notifications: [] };
      });
      mock.method(whatsappClient, 'sendTextMessage', async () => ({ outcome: 'accepted' }));
      mock.method(app.log, 'error', () => {});
      mock.method(app.log, 'info', () => {});
      mock.method(app.log, 'warn', () => {});

      const payload = {
        object: 'whatsapp_business_account',
        entry: [{
          id: '123',
          changes: [{
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: { display_phone_number: '1', phone_number_id: '2' },
              contacts: [{ profile: { name: 'Test' }, wa_id: '123456' }],
              messages: [{ from: '123456', id: 'wamid.retry1', timestamp: '123', type: 'text', text: { body: 'hello' } }]
            }
          }]
        }]
      };
      const payloadString = JSON.stringify(payload);
      const request = {
        method: 'POST' as const,
        url: '/webhook/whatsapp',
        headers: {
          'content-type': 'application/json',
          'x-hub-signature-256': signPayload(payloadString)
        },
        payload: payloadString
      };

      assert.strictEqual((await app.inject(request)).statusCode, 200);
      await new Promise(resolve => setTimeout(resolve, 50));
      assert.strictEqual(await prisma.processedWhatsappMessage.count({
        where: { messageId: 'wamid.retry1' }
      }), 0);

      assert.strictEqual((await app.inject(request)).statusCode, 200);
      await new Promise(resolve => setTimeout(resolve, 50));
      assert.strictEqual(attempts, 2);
      assert.strictEqual(await prisma.processedWhatsappMessage.count({
        where: { messageId: 'wamid.retry1' }
      }), 1);
    });

    test('should return 200 and process unsupported media by sending default reply', async () => {
      const payload = {
        object: 'whatsapp_business_account',
        entry: [{
          id: '123',
          changes: [{
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: { display_phone_number: '1', phone_number_id: '2' },
              contacts: [{ profile: { name: 'Test' }, wa_id: '123456' }],
              messages: [{ from: '123456', id: 'wamid.image1', timestamp: '123', type: 'image', image: {} }]
            }
          }]
        }]
      };
      
      const payloadString = JSON.stringify(payload);
      const response = await app.inject({
        method: 'POST',
        url: '/webhook/whatsapp',
        headers: {
          'content-type': 'application/json',
          'x-hub-signature-256': signPayload(payloadString)
        },
        payload: payloadString
      });

      assert.strictEqual(response.statusCode, 200);

      await waitFor(async () => {
        const outbound = await prisma.whatsappOutboundMessage.findUnique({
          where: { inboundMessageId: 'wamid.image1' }
        });
        return outbound?.status === 'sent';
      });

      const dedup = await prisma.processedWhatsappMessage.findUnique({ where: { messageId: 'wamid.image1' }});
      assert.ok(dedup !== null);
      const outbound = await prisma.whatsappOutboundMessage.findUnique({
        where: { inboundMessageId: 'wamid.image1' }
      });
      assert.strictEqual(outbound?.status, 'sent');

      const handleMessageCalls = (conversationService as any).handleMessageInTransaction.mock.calls;
      assert.strictEqual(handleMessageCalls.length, 0);
      
      const sendTextMessageCalls = (whatsappClient.sendTextMessage as any).mock.calls;
      assert.strictEqual(sendTextMessageCalls.length, 1);
      assert.deepStrictEqual(sendTextMessageCalls[0].arguments, ['123456', env.WHATSAPP_REPLY_UNSUPPORTED]);
    });

    test('should return 200 and not process status events', async () => {
      const payload = {
        object: 'whatsapp_business_account',
        entry: [{
          id: '123',
          changes: [{
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: { display_phone_number: '1', phone_number_id: '2' },
              statuses: [{ id: 'wamid.status1', status: 'read', timestamp: '1', recipient_id: '123456' }]
            }
          }]
        }]
      };
      
      const payloadString = JSON.stringify(payload);
      const response = await app.inject({
        method: 'POST',
        url: '/webhook/whatsapp',
        headers: {
          'content-type': 'application/json',
          'x-hub-signature-256': signPayload(payloadString)
        },
        payload: payloadString
      });

      assert.strictEqual(response.statusCode, 200);

      await new Promise(resolve => setTimeout(resolve, 50));

      const dedup = await prisma.processedWhatsappMessage.findUnique({ where: { messageId: 'wamid.status1' }});
      assert.strictEqual(dedup, null); // Status events are not deduplicated or processed

      const handleMessageCalls = (conversationService as any).handleMessageInTransaction.mock.calls;
      assert.strictEqual(handleMessageCalls.length, 0);
    });

    test('should return 200 and silently log empty/ignored events (e.g. manual test payload missing contacts)', async () => {
      // Simulate a handcrafted payload that misses the contacts array, forcing payloadParser to return 'ignored'
      const payload = {
        object: 'whatsapp_business_account',
        entry: [{
          id: '123',
          changes: [{
            field: 'messages',
            value: {
              messages: [{ from: '123456', id: 'wamid.phase9.manual.001', type: 'text', text: { body: 'hello' } }]
            }
          }]
        }]
      };
      
      const payloadString = JSON.stringify(payload);
      const response = await app.inject({
        method: 'POST',
        url: '/webhook/whatsapp',
        headers: {
          'content-type': 'application/json',
          'x-hub-signature-256': signPayload(payloadString)
        },
        payload: payloadString
      });

      assert.strictEqual(response.statusCode, 200);

      await new Promise(resolve => setTimeout(resolve, 50));

      const dedup = await prisma.processedWhatsappMessage.findUnique({ where: { messageId: 'wamid.phase9.manual.001' }});
      assert.strictEqual(dedup, null);

      // Verify that it was silently ignored rather than throwing an unhandled rejection
      const handleMessageCalls = (conversationService as any).handleMessageInTransaction.mock.calls;
      assert.strictEqual(handleMessageCalls.length, 0);
    });

    
    test('should not crash if conversationService throws after 200 response', async () => {
      mock.method(conversationService, 'handleMessage', async () => {
        throw new Error('Processing error');
      });
      
      const payload = {
        object: 'whatsapp_business_account',
        entry: [{
          id: '123',
          changes: [{
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: { display_phone_number: '1', phone_number_id: '2' },
              contacts: [{ profile: { name: 'Test' }, wa_id: '123456' }],
              messages: [{ from: '123456', id: 'wamid.test3', timestamp: '123', type: 'text', text: { body: 'hello' } }]
            }
          }]
        }]
      };
      
      const payloadString = JSON.stringify(payload);
      const response = await app.inject({
        method: 'POST',
        url: '/webhook/whatsapp',
        headers: {
          'content-type': 'application/json',
          'x-hub-signature-256': signPayload(payloadString)
        },
        payload: payloadString
      });

      assert.strictEqual(response.statusCode, 200);

      await new Promise(resolve => setTimeout(resolve, 50));
      const errorCalls = (app.log.error as any).mock.calls;
      assert.ok(errorCalls.length > 0);
    });
    
    test('should not log secrets', async () => {
      const payloadString = '{"test":"data"}';
      await app.inject({
        method: 'POST',
        url: '/webhook/whatsapp',
        headers: {
          'content-type': 'application/json',
          'x-hub-signature-256': 'wrong-signature'
        },
        payload: payloadString
      });
      
      // Look at all logged errors/warnings to make sure secrets are not present
      const allLogs = [
        ...(app.log.error as any).mock.calls,
        ...(app.log.warn as any).mock.calls
      ];
      
      for (const logCall of allLogs) {
        const logStr = JSON.stringify(logCall);
        assert.ok(!logStr.includes('test-secret'));
        assert.ok(!logStr.includes('test-verify'));
        assert.ok(!logStr.includes('test-token'));
      }
    });
  });
});
